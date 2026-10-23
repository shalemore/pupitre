import { ar } from "./locales/ar";
import { csCZ } from "./locales/cs-CZ";
import { daDK } from "./locales/da-DK";
import { deDE } from "./locales/de-DE";
import { elGR } from "./locales/el-GR";
import { enUS } from "./locales/en-US";
import { esES } from "./locales/es-ES";
import { faIR } from "./locales/fa-IR";
import { fiFI } from "./locales/fi-FI";
import { frFR } from "./locales/fr-FR";
import { hiIN } from "./locales/hi-IN";
import { huHU } from "./locales/hu-HU";
import { idID } from "./locales/id-ID";
import { isIS } from "./locales/is-IS";
import { itIT } from "./locales/it-IT";
import { jaJP } from "./locales/ja-JP";
import { koKR } from "./locales/ko-KR";
import { nbNO } from "./locales/nb-NO";
import { nlNL } from "./locales/nl-NL";
import { plPL } from "./locales/pl-PL";
import { ptBR } from "./locales/pt-BR";
import { ptPT } from "./locales/pt-PT";
import { ruRU } from "./locales/ru-RU";
import { svSE } from "./locales/sv-SE";
import { thTH } from "./locales/th-TH";
import { trTR } from "./locales/tr-TR";
import { ukUA } from "./locales/uk-UA";
import { viVN } from "./locales/vi-VN";
import { zhCN } from "./locales/zh-CN";
import { zhHK } from "./locales/zh-HK";
import { zhTW } from "./locales/zh-TW";
import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  type Direction,
  type LanguageSetting,
  type LocaleEntry,
  type LocaleMeta,
  type SupportedLocale,
  type TranslationSchema,
} from "./types";

export * from "./types";

// Each language is listed under its own name, with the region it is written for. The script
// comes first (Chinese), then the region, which tells apart what one script does not.
// Record keys are checked against LOCALE_CODES, so a locale cannot be added in only one place.
const LOCALES: Record<SupportedLocale, LocaleEntry> = {
  "en-US": { label: "English (United States)", dir: "ltr", dictionary: enUS },
  ar: { label: "العربية", dir: "rtl", dictionary: ar },
  "cs-CZ": { label: "Čeština (Česko)", dir: "ltr", dictionary: csCZ },
  "da-DK": { label: "Dansk (Danmark)", dir: "ltr", dictionary: daDK },
  "de-DE": { label: "Deutsch (Deutschland)", dir: "ltr", dictionary: deDE },
  "el-GR": { label: "Ελληνικά (Ελλάδα)", dir: "ltr", dictionary: elGR },
  "es-ES": { label: "Español (España)", dir: "ltr", dictionary: esES },
  "fa-IR": { label: "فارسی (ایران)", dir: "rtl", dictionary: faIR },
  "fi-FI": { label: "Suomi", dir: "ltr", dictionary: fiFI },
  "fr-FR": { label: "Français (France)", dir: "ltr", dictionary: frFR },
  "hi-IN": { label: "हिन्दी (भारत)", dir: "ltr", dictionary: hiIN },
  "hu-HU": { label: "Magyar (Magyarország)", dir: "ltr", dictionary: huHU },
  "id-ID": { label: "Bahasa Indonesia (Indonesia)", dir: "ltr", dictionary: idID },
  "is-IS": { label: "Íslenska (Ísland)", dir: "ltr", dictionary: isIS },
  "it-IT": { label: "Italiano (Italia)", dir: "ltr", dictionary: itIT },
  "ja-JP": { label: "日本語 (日本)", dir: "ltr", dictionary: jaJP },
  "ko-KR": { label: "한국어 (대한민국)", dir: "ltr", dictionary: koKR },
  "nb-NO": { label: "Norsk bokmål (Norge)", dir: "ltr", dictionary: nbNO },
  "nl-NL": { label: "Nederlands (Nederland)", dir: "ltr", dictionary: nlNL },
  "pl-PL": { label: "Polski (Polska)", dir: "ltr", dictionary: plPL },
  "pt-BR": { label: "Português (Brasil)", dir: "ltr", dictionary: ptBR },
  "pt-PT": { label: "Português (Portugal)", dir: "ltr", dictionary: ptPT },
  "ru-RU": { label: "Русский (Россия)", dir: "ltr", dictionary: ruRU },
  "sv-SE": { label: "Svenska (Sverige)", dir: "ltr", dictionary: svSE },
  "th-TH": { label: "ไทย", dir: "ltr", dictionary: thTH },
  "tr-TR": { label: "Türkçe (Türkiye)", dir: "ltr", dictionary: trTR },
  "uk-UA": { label: "Українська (Україна)", dir: "ltr", dictionary: ukUA },
  "vi-VN": { label: "Tiếng Việt (Việt Nam)", dir: "ltr", dictionary: viVN },
  "zh-CN": { label: "简体中文 (中国大陆)", dir: "ltr", dictionary: zhCN },
  "zh-HK": { label: "繁體中文 (香港)", dir: "ltr", dictionary: zhHK },
  "zh-TW": { label: "繁體中文 (台灣)", dir: "ltr", dictionary: zhTW },
};

export const SUPPORTED_LOCALES: readonly LocaleMeta[] = LOCALE_CODES.map((code) => ({
  code,
  label: LOCALES[code].label,
  dir: LOCALES[code].dir,
}));

/**
 * Traditional Chinese is a script, not a region: the same dictionary serves Taiwan, Hong Kong
 * and Macau, so their system locales land on it even though only two of the three are listed.
 */
const HANT_REGIONS: Partial<Record<string, SupportedLocale>> = {
  HK: "zh-HK",
  TW: "zh-TW",
};
const HANT_DEFAULT: SupportedLocale = "zh-TW";

/**
 * Browsers and systems spell Norwegian Bokmål as "nb" or "no", and Nynorsk ("nn") users read
 * Bokmål more easily than anything English.
 */
const NORWEGIAN_TAGS: ReadonlySet<string> = new Set(["nb", "nb-NO", "nn", "nn-NO", "no", "no-NO"]);

function matchChinese(tag: Intl.Locale): SupportedLocale {
  if (tag.script !== "Hant") return "zh-CN";
  return (tag.region && HANT_REGIONS[tag.region]) || HANT_DEFAULT;
}

/**
 * Picks the first supported language from the system's preferred languages; the same language
 * in another region (such as en-GB) also matches.
 */
function matchLocale(preferredLanguages: readonly string[]): SupportedLocale {
  for (const language of preferredLanguages) {
    if (NORWEGIAN_TAGS.has(language)) return "nb-NO";
    const tag = new Intl.Locale(language).maximize();
    if (tag.language === "zh") return matchChinese(tag);
    const exact = SUPPORTED_LOCALES.find(
      (locale) => locale.code === `${tag.language}-${tag.region}`,
    );
    // Compare the language subtag so region-less codes such as "ar" also match "ar-EG"
    const sameLanguage = SUPPORTED_LOCALES.find(
      (locale) => new Intl.Locale(locale.code).language === tag.language,
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
  return LOCALES[locale].dictionary;
}

export function getDirection(locale: SupportedLocale): Direction {
  return LOCALES[locale].dir;
}
