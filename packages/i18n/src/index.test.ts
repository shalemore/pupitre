import { describe, expect, it } from "vitest";
import { resolveLocale } from "./index";

describe("resolveLocale", () => {
  it("picks the first preferred language it has", () => {
    expect(resolveLocale("auto", ["fr-CA", "en-US"])).toBe("fr-FR");
    expect(resolveLocale("auto", ["no"])).toBe("nb-NO");
    expect(resolveLocale("auto", ["zh-Hant-HK"])).toBe("zh-HK");
  });

  it("uses the language the user chose over the system's", () => {
    expect(resolveLocale("de-DE", ["en-US"])).toBe("de-DE");
  });

  // A Linux session that sets no locale reports "C", which Intl refuses to read as one; the app
  // still has to open, and the next tag it can read decides the language
  it("skips a system tag Intl cannot read", () => {
    expect(resolveLocale("auto", ["C", "sv-SE"])).toBe("sv-SE");
    expect(resolveLocale("auto", ["en_US.UTF-8"])).toBe("en-US");
  });

  it("falls back to English when no tag matches", () => {
    expect(resolveLocale("auto", [])).toBe("en-US");
    expect(resolveLocale("auto", ["C"])).toBe("en-US");
  });
});
