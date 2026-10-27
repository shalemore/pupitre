export interface TextStats {
  words: number;
  characters: number;
  /** Counted over the selection; absent while nothing is selected. */
  selectedWords?: number;
  selectedCharacters?: number;
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

function isWordCharacter(code: number, character: string): boolean {
  if (code < 0x80) {
    return (
      (code >= 0x30 && code <= 0x39) ||
      (code >= 0x41 && code <= 0x5a) ||
      (code >= 0x61 && code <= 0x7a) ||
      code === 0x5f
    );
  }
  return /[\p{L}\p{M}\p{N}\p{Pc}]/u.test(character);
}

function isWhitespace(code: number, character: string): boolean {
  if (code <= 0x20) return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
  return /\s/u.test(character);
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

/**
 * Counts words without Intl.Segmenter, for documents large enough that segmenting every word
 * would take seconds. Latin, Cyrillic, Arabic, Indic and CJK text follow the same rules as
 * `countText`; the dense scripts that need a dictionary still go through the segmenter, one run at
 * a time, so they stay correct without paying for the rest of the document.
 */
function countWordsFast(text: string): number {
  let words = 0;
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
    const length = code > 0xffff ? 2 : 1;
    const character = text.slice(index, index + length);
    index += length;

    if (isCjk(code)) {
      words++;
      inWord = false;
      continue;
    }
    // U+30FC prolongs the kana before it and is not a word of its own
    if (code === 0x30fc) {
      inWord = false;
      continue;
    }

    if (isWordCharacter(code, character) && isDenseScript(code)) {
      let end = index;
      while (end < text.length) {
        const next = text.codePointAt(end) ?? 0;
        if (
          isWordCharacter(next, text.slice(end, end + (next > 0xffff ? 2 : 1))) ||
          next === ZERO_WIDTH_NON_JOINER ||
          next === ZERO_WIDTH_JOINER
        ) {
          end += next > 0xffff ? 2 : 1;
        } else {
          break;
        }
      }
      for (const segment of wordSegmenter.segment(text.slice(index - length, end))) {
        if (segment.isWordLike) words++;
      }
      inWord = false;
      index = end;
      continue;
    }

    if (isWordCharacter(code, character)) {
      if (!inWord) words++;
      inWord = true;
      continue;
    }
    // An apostrophe or a zero-width joiner keeps a word together; a hyphen starts another one
    if (
      code === APOSTROPHE ||
      code === 0x2019 ||
      code === ZERO_WIDTH_NON_JOINER ||
      code === ZERO_WIDTH_JOINER
    ) {
      continue;
    }
    inWord = false;
  }
  return words;
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
    const length = code > 0xffff ? 2 : 1;
    const character = text.slice(index, index + length);
    index += length;

    if (isWhitespace(code, character)) {
      previousWasRegionalIndicator = false;
      joinNext = false;
      continue;
    }
    if (code === ZERO_WIDTH_NON_JOINER) continue;
    if (code === ZERO_WIDTH_JOINER) {
      joinNext = true;
      continue;
    }
    if (COMBINING_MARK.test(character) || VARIATION_SELECTOR(code) || EMOJI_MODIFIER(code)) {
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
  for (const segment of wordSegmenter.segment(text)) {
    if (!segment.isWordLike) continue;
    const cjk = segment.segment.match(CJK_CHARACTER)?.length ?? 0;
    words += cjk > 0 ? cjk : 1;
  }
  let characters = 0;
  for (const { segment } of graphemeSegmenter.segment(text)) {
    if (segment.trim()) characters++;
  }
  return { words, characters };
}

/** The counts for a range large enough that `countText` would stall the editor. */
export function countTextFast(text: string): TextStats {
  return { words: countWordsFast(text), characters: countCharactersFast(text) };
}
