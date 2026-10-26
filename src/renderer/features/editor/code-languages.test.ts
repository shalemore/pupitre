import { LanguageDescription } from "@codemirror/language";
import { describe, expect, it } from "vitest";
import { codeLanguages } from "./code-languages";

const SPACE_NAMES: readonly (readonly [name: string, alias: string])[] = [
  ["MariaDB SQL", "mariadb"],
  ["MS SQL", "mssql"],
  ["Closure Stylesheets (GSS)", "gss"],
  ["RPM Changes", "rpmchanges"],
  ["RPM Spec", "rpmspec"],
  ["Tiki wiki", "tiki"],
  ["Web IDL", "webidl"],
  ["Angular Template", "ngtemplate"],
];

describe("codeLanguages", () => {
  it("gives every grammar whose own names hold a space a fence name", () => {
    for (const [name, alias] of SPACE_NAMES) {
      const language = codeLanguages.find((candidate) => candidate.name === name);
      expect(language).toBeDefined();
      expect(language?.alias).toContain(alias);
      expect(LanguageDescription.matchLanguageName(codeLanguages, alias, true)?.name).toBe(name);
    }
  });

  it("keeps the grammars that already have a space-free alias", () => {
    const lisp = LanguageDescription.matchLanguageName(codeLanguages, "lisp", true);
    expect(lisp?.name).toBe("Common Lisp");
    const ini = LanguageDescription.matchLanguageName(codeLanguages, "ini", true);
    expect(ini?.name).toBe("Properties files");
  });
});
