import { arSA } from "./locales/ar-SA";
import { deDE } from "./locales/de-DE";
import { enUS } from "./locales/en-US";
import { esES } from "./locales/es-ES";
import { frFR } from "./locales/fr-FR";
import { itIT } from "./locales/it-IT";
import { jaJP } from "./locales/ja-JP";
import { koKR } from "./locales/ko-KR";
import { ptBR } from "./locales/pt-BR";
import { ruRU } from "./locales/ru-RU";
import { zhCN } from "./locales/zh-CN";
import { zhTW } from "./locales/zh-TW";
import {
  DEFAULT_LOCALE,
  type Direction,
  type LanguageSetting,
  type LocaleMeta,
  type SupportedLocale,
  type TranslationSchema,
} from "./types";

export * from "./types";

export const SUPPORTED_LOCALES: readonly LocaleMeta[] = [
  { code: "en-US", label: "English", dir: "ltr" },
  { code: "ar-SA", label: "العربية", dir: "rtl" },
  { code: "de-DE", label: "Deutsch", dir: "ltr" },
  { code: "es-ES", label: "Español", dir: "ltr" },
  { code: "fr-FR", label: "Français", dir: "ltr" },
  { code: "it-IT", label: "Italiano", dir: "ltr" },
  { code: "ja-JP", label: "日本語", dir: "ltr" },
  { code: "ko-KR", label: "한국어", dir: "ltr" },
  { code: "pt-BR", label: "Português", dir: "ltr" },
  { code: "ru-RU", label: "Русский", dir: "ltr" },
  { code: "zh-CN", label: "简体中文", dir: "ltr" },
  { code: "zh-TW", label: "繁體中文", dir: "ltr" },
];

const dictionaries: Record<SupportedLocale, TranslationSchema> = {
  "en-US": enUS,
  "ar-SA": arSA,
  "de-DE": deDE,
  "es-ES": esES,
  "fr-FR": frFR,
  "it-IT": itIT,
  "ja-JP": jaJP,
  "ko-KR": koKR,
  "pt-BR": ptBR,
  "ru-RU": ruRU,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
};

/** Picks the first supported language from the system's preferred languages; the same language in another region (such as en-GB) also matches. */
export function matchLocale(preferredLanguages: readonly string[]): SupportedLocale {
  for (const language of preferredLanguages) {
    const tag = new Intl.Locale(language).maximize();
    // Chinese is told apart by script (Simplified or Traditional), not by region
    if (tag.language === "zh") {
      return tag.script === "Hant" ? "zh-TW" : "zh-CN";
    }
    const exact = SUPPORTED_LOCALES.find(
      (locale) => locale.code === `${tag.language}-${tag.region}`,
    );
    const sameLanguage = SUPPORTED_LOCALES.find((locale) =>
      locale.code.startsWith(`${tag.language}-`),
    );
    const match = exact ?? sameLanguage;
    if (match) return match.code;
  }
  return DEFAULT_LOCALE;
}

export function resolveLocale(
  setting: LanguageSetting,
  preferredLanguages: readonly string[],
): SupportedLocale {
  return setting === "auto" ? matchLocale(preferredLanguages) : setting;
}

export function getDictionary(locale: SupportedLocale): TranslationSchema {
  return dictionaries[locale];
}

export function getDirection(locale: SupportedLocale): Direction {
  return locale === "ar-SA" ? "rtl" : "ltr";
}
