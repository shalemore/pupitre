import { describe, expect, it } from "vitest";
import { countText } from "./text-stats";

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
