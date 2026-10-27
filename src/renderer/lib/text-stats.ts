export interface TextStats {
  words: number;
  characters: number;
  /** Han, Hiragana and Katakana characters, which are counted one by one as words. */
  cjk: number;
  /** Counted over the selection; absent while nothing is selected. */
  selectedWords?: number;
  selectedCharacters?: number;
  selectedCjk?: number;
}

const wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
// Chinese and Japanese are not split by spaces; by convention (as in Word and similar tools) each Han character or kana counts as one word
const CJK_CHARACTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu;

/** The scripts whose words are not separated by spaces and need the dictionary segmenter. */
function isDenseScript(code: number): boolean {
  return (
    (code >= 0x0e00 && code <= 0x0e7f) ||
    (code >= 0x0e80 && code <= 0x0eff) ||
    (code >= 0x1000 && code <= 0x109f) ||
    (code >= 0x1780 && code <= 0x17ff)
  );
}

/** Han, Hiragana and Katakana, the characters counted one by one like Word does. */
function isCjk(code: number): boolean {
  return (
    (code >= 0x3041 && code <= 0x3096) ||
    (code >= 0x309d && code <= 0x309f) ||
    (code >= 0x30a1 && code <= 0x30fa) ||
    (code >= 0x30fd && code <= 0x30ff) ||
    (code >= 0x31f0 && code <= 0x31ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0x20000 && code <= 0x323af) ||
    (code >= 0xff66 && code <= 0xff9d)
  );
}

const WORD_CHARACTER = /[\p{L}\p{M}\p{N}\p{Pc}]/u;

function isWordCharacter(code: number, text: string, start: number, end: number): boolean {
  if (code < 0x80) {
    return (
      (code >= 0x30 && code <= 0x39) ||
      (code >= 0x41 && code <= 0x5a) ||
      (code >= 0x61 && code <= 0x7a) ||
      code === 0x5f
    );
  }
  // Common Latin, Greek and Cyrillic ranges avoid slicing a string for every non-ASCII letter
  if (
    (code >= 0x00c0 && code <= 0x024f && code !== 0x00d7 && code !== 0x00f7) ||
    (code >= 0x0400 && code <= 0x04ff)
  ) {
    return true;
  }
  // General, CJK and full-width punctuation and spaces are never word characters
  if (
    (code >= 0x2000 && code <= 0x206f) ||
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0xff00 && code <= 0xff0f) ||
    (code >= 0xff1a && code <= 0xff20)
  ) {
    return false;
  }
  return WORD_CHARACTER.test(text.slice(start, end));
}

/** Unicode whitespace code points (ECMAScript `\s`), checked without allocating a substring. */
function isWhitespace(code: number): boolean {
  if (code <= 0x20) return code === 0x20 || (code >= 0x09 && code <= 0x0d);
  if (code < 0x1680) return code === 0x0085 || code === 0x00a0;
  return (
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff ||
    code === 0x1680
  );
}

const APOSTROPHE = 0x27;
const ZERO_WIDTH_NON_JOINER = 0x200c;
const ZERO_WIDTH_JOINER = 0x200d;
const COMBINING_MARK = /^\p{M}$/u;
const VARIATION_SELECTOR = (code: number) =>
  (code >= 0xfe00 && code <= 0xfe0f) || (code >= 0xe0100 && code <= 0xe01ef);
const EMOJI_MODIFIER = (code: number) => code >= 0x1f3fb && code <= 0x1f3ff;
const REGIONAL_INDICATOR = (code: number) => code >= 0x1f1e6 && code <= 0x1f1ff;
/** A virama joins the consonant after it into the same grapheme. */
const VIRAMA = new Set([
  0x094d, 0x09cd, 0x0a4d, 0x0acd, 0x0b4d, 0x0bcd, 0x0c4d, 0x0ccd, 0x0d4d, 0x0dca, 0x0e3a, 0x0eba,
  0x0f84, 0x1039, 0x103a, 0x1714, 0x1734, 0x17d2, 0x1a60, 0x1b44, 0x1baa, 0x1bab,
]);
/** A spacing vowel that is written after the consonant but belongs to its cluster. */
const TRAILING_VOWEL = (code: number) => code === 0x0e33 || code === 0x0eb3;

function isCombiningMark(code: number, text: string, start: number, end: number): boolean {
  // Combining marks start at U+0300; common letters, punctuation and CJK blocks hold none
  if (
    code < 0x0300 ||
    (code >= 0x0400 && code <= 0x0482) ||
    (code >= 0x048a && code <= 0x04ff) ||
    (code >= 0x2000 && code <= 0x206f) ||
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0xff00 && code <= 0xffef)
  ) {
    return false;
  }
  if (code <= 0x036f) return true;
  return COMBINING_MARK.test(text.slice(start, end));
}

/**
 * Counts words without Intl.Segmenter, for documents large enough that segmenting every word
 * would take seconds. Latin, Cyrillic, Arabic, Indic and CJK text follow the same rules as
 * `countText`; the dense scripts that need a dictionary still go through the segmenter, one run at
 * a time, so they stay correct without paying for the rest of the document.
 */
function countWordsFast(text: string): { words: number; cjk: number } {
  let words = 0;
  let cjk = 0;
  let inWord = false;
  for (let index = 0; index < text.length;) {
    const code = text.codePointAt(index) ?? 0;
    if (code < 0x80) {
      index++;
      const isWord =
        (code >= 0x30 && code <= 0x39) ||
        (code >= 0x41 && code <= 0x5a) ||
        (code >= 0x61 && code <= 0x7a) ||
        code === 0x5f;
      if (isWord) {
        if (!inWord) words++;
        inWord = true;
      } else if (code !== APOSTROPHE) {
        inWord = false;
      }
      continue;
    }
    const start = index;
    const length = code > 0xffff ? 2 : 1;
    index += length;

    if (isCjk(code)) {
      words++;
      cjk++;
      inWord = false;
      continue;
    }
    // U+30FC prolongs the kana before it and is not a word of its own
    if (code === 0x30fc) {
      inWord = false;
      continue;
    }
    // An apostrophe or a zero-width joiner keeps a word together; a hyphen starts another one
    if (code === 0x2019 || code === ZERO_WIDTH_NON_JOINER || code === ZERO_WIDTH_JOINER) {
      continue;
    }

    if (isDenseScript(code) && isWordCharacter(code, text, start, index)) {
      let end = index;
      while (end < text.length) {
        const next = text.codePointAt(end) ?? 0;
        const nextEnd = end + (next > 0xffff ? 2 : 1);
        if (
          isWordCharacter(next, text, end, nextEnd) ||
          next === ZERO_WIDTH_NON_JOINER ||
          next === ZERO_WIDTH_JOINER
        ) {
          end = nextEnd;
        } else {
          break;
        }
      }
      for (const segment of wordSegmenter.segment(text.slice(start, end))) {
        if (segment.isWordLike) words++;
      }
      inWord = false;
      index = end;
      continue;
    }

    if (isWordCharacter(code, text, start, index)) {
      if (!inWord) words++;
      inWord = true;
      continue;
    }
    inWord = false;
  }
  return { words, cjk };
}

/**
 * Counts the characters a reader sees without Intl.Segmenter, for large selections and documents.
 * It follows grapheme clusters closely enough for the title bar: marks, variation selectors,
 * zero-width joiners, emoji modifiers and regional-indicator pairs do not add a character.
 */
function countCharactersFast(text: string): number {
  let characters = 0;
  let previousWasRegionalIndicator = false;
  let joinNext = false;
  for (let index = 0; index < text.length;) {
    const code = text.codePointAt(index) ?? 0;
    if (code < 0x80) {
      index++;
      if (code <= 0x20 || code === 0x7f) {
        previousWasRegionalIndicator = false;
        joinNext = false;
        continue;
      }
      if (joinNext) {
        joinNext = false;
        previousWasRegionalIndicator = false;
        continue;
      }
      characters++;
      previousWasRegionalIndicator = false;
      continue;
    }
    const start = index;
    const length = code > 0xffff ? 2 : 1;
    index += length;

    if (isCjk(code)) {
      if (joinNext) joinNext = false;
      else characters++;
      previousWasRegionalIndicator = false;
      continue;
    }
    if (isWhitespace(code)) {
      previousWasRegionalIndicator = false;
      joinNext = false;
      continue;
    }
    if (code === ZERO_WIDTH_NON_JOINER) continue;
    if (code === ZERO_WIDTH_JOINER) {
      joinNext = true;
      continue;
    }
    if (
      VARIATION_SELECTOR(code) ||
      EMOJI_MODIFIER(code) ||
      isCombiningMark(code, text, start, index)
    ) {
      continue;
    }
    if (VIRAMA.has(code)) {
      joinNext = true;
      continue;
    }
    if (TRAILING_VOWEL(code)) continue;
    if (joinNext) {
      joinNext = false;
      previousWasRegionalIndicator = false;
      continue;
    }
    const regionalIndicator = REGIONAL_INDICATOR(code);
    if (regionalIndicator && previousWasRegionalIndicator) {
      previousWasRegionalIndicator = false;
      continue;
    }
    characters++;
    previousWasRegionalIndicator = regionalIndicator;
  }
  return characters;
}

export function countText(text: string): TextStats {
  let words = 0;
  let cjkTotal = 0;
  for (const segment of wordSegmenter.segment(text)) {
    if (!segment.isWordLike) continue;
    const cjk = segment.segment.match(CJK_CHARACTER)?.length ?? 0;
    cjkTotal += cjk;
    words += cjk > 0 ? cjk : 1;
  }
  let characters = 0;
  for (const { segment } of graphemeSegmenter.segment(text)) {
    if (segment.trim()) characters++;
  }
  return { words, characters, cjk: cjkTotal };
}

/** The counts for a range large enough that `countText` would stall the editor. */
export function countTextFast(text: string): TextStats {
  const { words, cjk } = countWordsFast(text);
  return { words, characters: countCharactersFast(text), cjk };
}
