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
