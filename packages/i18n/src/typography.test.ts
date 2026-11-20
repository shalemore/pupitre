import { describe, expect, it } from "vitest";
import { getDictionary, SUPPORTED_LOCALES } from "./index";

interface DictionaryString {
  path: string;
  text: string;
}

/** Every literal in a dictionary, with the key path that `smartDashesDesc` needs to be told apart. */
function dictionaryStrings(value: unknown, path = ""): DictionaryString[] {
  if (typeof value === "string") return [{ path, text: value }];
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    dictionaryStrings(child, path === "" ? key : `${path}.${key}`),
  );
}

// Han directly against a Latin letter or digit; Chinese keeps a space there, unlike Japanese
const HAN_AGAINST_LATIN = /[\p{Script=Han}][A-Za-z0-9]|[A-Za-z0-9][\p{Script=Han}]/u;
const CHINESE_LOCALES = SUPPORTED_LOCALES.filter(({ code }) => code.startsWith("zh-"));

describe("translation typography", () => {
  for (const { code } of SUPPORTED_LOCALES) {
    it(`${code} uses the ellipsis character in UI labels`, () => {
      const offenders = dictionaryStrings(getDictionary(code)).filter(
        ({ path, text }) => path !== "settings.smartDashesDesc" && text.includes("..."),
      );
      expect(offenders).toEqual([]);
    });
  }

  for (const { code } of CHINESE_LOCALES) {
    it(`${code} spaces Han from Latin letters and digits`, () => {
      const offenders = dictionaryStrings(getDictionary(code)).filter(({ text }) =>
        HAN_AGAINST_LATIN.test(text),
      );
      expect(offenders).toEqual([]);
    });
  }
});
