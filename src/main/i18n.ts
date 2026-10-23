import { app } from "electron";
import { getDictionary, resolveLocale, type TranslationSchema } from "@shared/i18n";
import { getSettings } from "./settings-store";

export function t(): TranslationSchema {
  return getDictionary(resolveLocale(getSettings().locale, app.getPreferredSystemLanguages()));
}
