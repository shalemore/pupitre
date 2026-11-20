import type { enUS } from "./locales/en-US";

export type Direction = "ltr" | "rtl";

/**
 * BCP 47 tags. Most use the region CLDR gives each language by default (not always its
 * homeland, hence en-US and pt-BR). Arabic carries no region because it is the standard
 * language, understood everywhere it is read, not a regional dialect. The region only
 * carries meaning for Portuguese, whose Brazilian and European forms are different
 * languages in practice, and for the three Chinese standards.
 */
export const LOCALE_CODES = [
  "en-US",
  "ar",
  "cs-CZ",
  "da-DK",
  "de-DE",
  "el-GR",
  "es-ES",
  "fa-IR",
  "fi-FI",
  "fr-FR",
  "hi-IN",
  "hu-HU",
  "id-ID",
  "is-IS",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "nb-NO",
  "nl-NL",
  "pl-PL",
  "pt-BR",
  "pt-PT",
  "ru-RU",
  "sv-SE",
  "th-TH",
  "tr-TR",
  "uk-UA",
  "vi-VN",
  "zh-CN",
  "zh-HK",
  "zh-TW",
] as const;

export type SupportedLocale = (typeof LOCALE_CODES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en-US";

export type LanguageSetting = "auto" | SupportedLocale;

export interface LocaleMeta {
  readonly code: SupportedLocale;
  readonly label: string;
  readonly dir: Direction;
}

export interface LocaleEntry extends Omit<LocaleMeta, "code"> {
  readonly dictionary: TranslationSchema;
}

/**
 * A dictionary holds the strings of one language, in the shape of the English one: adding a string
 * to `en-US` makes every other locale fail to typecheck until it has one too.
 */
export type TranslationSchema = typeof enUS;
