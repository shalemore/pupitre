import { describe, expect, it } from "vitest";
import { countText, countTextFast } from "./text-stats";

describe("countText", () => {
  it("counts words split by spaces", () => {
    expect(countText("Hello, world. It's here.")).toEqual({ words: 4, characters: 21 });
  });

  it("counts each Han character and kana as a word", () => {
    expect(countText("中文字数").words).toBe(4);
    expect(countText("日本語のテキスト").words).toBe(8);
    expect(countText("Pupitre 编辑器").words).toBe(4);
  });

  it("counts a character as the reader sees it", () => {
    expect(countText("👨‍👩‍👧 é").characters).toBe(2);
    expect(countText("  \n\t").characters).toBe(0);
  });
});

describe("countTextFast", () => {
  it("counts the same text as the segmenter for the common scripts", () => {
    expect(countTextFast("Hello, world. It's here.")).toEqual({ words: 4, characters: 21 });
    expect(countTextFast("中文字数")).toEqual({ words: 4, characters: 4 });
    expect(countTextFast("日本語のテキスト")).toEqual({ words: 8, characters: 8 });
    expect(countTextFast("コーヒー")).toEqual({ words: 2, characters: 4 });
    expect(countTextFast("Pupitre 编辑器")).toEqual({ words: 4, characters: 10 });
  });

  it("keeps the scripts that need a dictionary whole", () => {
    expect(countTextFast("ภาษาไทยง่ายนิดเดียว")).toEqual({ words: 5, characters: 16 });
    expect(countTextFast("می‌رود").words).toBe(1);
  });

  it("counts grapheme clusters without the grapheme segmenter", () => {
    expect(countTextFast("👨‍👩‍👧 é")).toEqual({ words: 1, characters: 2 });
    expect(countTextFast("🇨🇳🇺🇸").characters).toBe(2);
    expect(countTextFast("👍🏽").characters).toBe(1);
    expect(countTextFast("  \n\t").characters).toBe(0);
  });
});
