import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";

/**
 * Grammars whose names and aliases all hold a space cannot be named by a fence info string, which
 * ends at the first space. Give each a space-free alias so the picker and a hand-written fence can
 * reach it; the grammar itself is the same one.
 */
const EXTRA_ALIASES: Readonly<Record<string, string>> = {
  "MariaDB SQL": "mariadb",
  "MS SQL": "mssql",
  "Closure Stylesheets (GSS)": "gss",
  "RPM Changes": "rpmchanges",
  "RPM Spec": "rpmspec",
  "Tiki wiki": "tiki",
  "Web IDL": "webidl",
  "Angular Template": "ngtemplate",
};

/** The grammars a fence can name, with a space-free alias for the ones whose own names have none. */
export const codeLanguages: readonly LanguageDescription[] = languages.map((language) => {
  const alias = EXTRA_ALIASES[language.name];
  if (alias === undefined) return language;
  return LanguageDescription.of({
    name: language.name,
    alias: [...language.alias, alias],
    extensions: language.extensions,
    ...(language.filename === undefined ? {} : { filename: language.filename }),
    load: () => language.load(),
  });
});
