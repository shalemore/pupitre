import {
  getDictionary,
  resolveLocale,
  type SupportedLocale,
  type TranslationSchema,
} from "@pupitre/i18n";
import { app } from "electron";
import { getSettings } from "./settings/settings-store";

export function currentLocale(): SupportedLocale {
  return resolveLocale(getSettings().locale, app.getPreferredSystemLanguages());
}

export function t(): TranslationSchema {
  return getDictionary(currentLocale());
}
