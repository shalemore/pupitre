import { session } from "electron";
import { currentLocale } from "../i18n";
import { getSettings } from "../settings/settings-store";

/**
 * The dictionary to check the interface locale with, out of the ones Chromium ships. It names
 * dictionaries by region ("pt-BR", "en-US"), while the app may ask for a tag it has none for, so
 * the exact tag wins over its bare language, and any region of that language over English.
 */
function spellCheckerLanguage(available: readonly string[]): string {
  const locale = currentLocale();
  const exact = available.find((code) => code.toLowerCase() === locale.toLowerCase());
  if (exact !== undefined) return exact;
  const { language } = new Intl.Locale(locale);
  const bare = available.find((code) => code.toLowerCase() === language);
  if (bare !== undefined) return bare;
  const region = available.find((code) => code.toLowerCase().startsWith(`${language}-`));
  return region ?? "en-US";
}

/**
 * Applies the spell check setting to the session every window shares, so a window opened after a
 * change finds it already applied. Chromium refuses a language it has no dictionary for, which is
 * most of the languages the app speaks; English is the fallback rather than leaving the document
 * unchecked. Nothing here may throw: the app has to open whether or not a dictionary can be used.
 */
export function applySpellCheck(): void {
  const spellChecker = session.defaultSession;
  // Setting the languages switches the checker on, so the setting is applied after them
  try {
    spellChecker.setSpellCheckerLanguages([
      spellCheckerLanguage(spellChecker.availableSpellCheckerLanguages),
    ]);
  } catch {
    // A session that is not ready yet only costs the check until the setting is applied again
  }
  try {
    spellChecker.setSpellCheckerEnabled(getSettings().spellcheck);
  } catch {
    // A checker that cannot be switched off must not keep the window from opening either
  }
}
