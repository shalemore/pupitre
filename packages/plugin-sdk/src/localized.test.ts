import { describe, expect, it } from "vitest";
import { localize } from "./localized";

const text = { en: "Trail", "zh-CN": "拖尾", "zh-HK": "拖尾效果", fr: "Traînée" };

describe("localize", () => {
  it("keeps a plain string in every locale", () => {
    expect(localize("Hello", "ja-JP")).toBe("Hello");
  });

  it("finds the locale, then its language, then English", () => {
    expect(localize(text, "zh-CN")).toBe("拖尾");
    expect(localize(text, "fr-CA")).toBe("Traînée");
    expect(localize(text, "zh-TW")).toBe("Trail");
  });

  it("compares locale tags without case", () => {
    expect(localize(text, "ZH-cn")).toBe("拖尾");
  });
});
