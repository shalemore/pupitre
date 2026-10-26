import { app, session } from "electron";
import { resolveLocale } from "@shared/i18n";
import { getSettings } from "./settings-store";

/** Chromium names its dictionaries by language, while the interface locale carries a region too. */
function spellCheckerLanguage(): string {
  const locale = resolveLocale(getSettings().locale, app.getPreferredSystemLanguages());
  return new Intl.Locale(locale).language;
}

/**
 * Applies the spell check setting to the session every window shares, so a window opened after a
 * change finds it already applied. Chromium refuses a language it has no dictionary for, which is
 * most of the languages the app speaks; English is the fallback rather than leaving the document
 * unchecked.
 */
export function applySpellCheck(): void {
  const spellChecker = session.defaultSession;
  const language = spellCheckerLanguage();
  // Setting the languages switches the checker on, so the setting is applied after them
  try {
    spellChecker.setSpellCheckerLanguages([language]);
  } catch {
    spellChecker.setSpellCheckerLanguages(["en-US"]);
  }
  spellChecker.setSpellCheckerEnabled(getSettings().spellcheck);
}
