import { app } from "electron";
import {
  getDictionary,
  resolveLocale,
  type SupportedLocale,
  type TranslationSchema,
} from "@shared/i18n";
import { getSettings } from "./settings-store";

export function currentLocale(): SupportedLocale {
  return resolveLocale(getSettings().locale, app.getPreferredSystemLanguages());
}

export function t(): TranslationSchema {
  return getDictionary(currentLocale());
}
