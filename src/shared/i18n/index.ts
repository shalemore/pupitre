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
  type Direction,
  type LanguageSetting,
  type LocaleMeta,
  type SupportedLocale,
  type TranslationSchema,
} from "./types";

export * from "./types";

// Each language is listed under its own name, with the region it is written for. The script
// comes first (Chinese), then the region, which tells apart what one script does not.
export const SUPPORTED_LOCALES: readonly LocaleMeta[] = [
  { code: "en-US", label: "English (United States)", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "cs-CZ", label: "Čeština (Česko)", dir: "ltr" },
  { code: "da-DK", label: "Dansk (Danmark)", dir: "ltr" },
  { code: "de-DE", label: "Deutsch (Deutschland)", dir: "ltr" },
  { code: "el-GR", label: "Ελληνικά (Ελλάδα)", dir: "ltr" },
  { code: "es-ES", label: "Español (España)", dir: "ltr" },
  { code: "fa-IR", label: "فارسی (ایران)", dir: "rtl" },
  { code: "fi-FI", label: "Suomi", dir: "ltr" },
  { code: "fr-FR", label: "Français (France)", dir: "ltr" },
  { code: "hi-IN", label: "हिन्दी (भारत)", dir: "ltr" },
  { code: "hu-HU", label: "Magyar (Magyarország)", dir: "ltr" },
  { code: "id-ID", label: "Bahasa Indonesia (Indonesia)", dir: "ltr" },
  { code: "is-IS", label: "Íslenska (Ísland)", dir: "ltr" },
  { code: "it-IT", label: "Italiano (Italia)", dir: "ltr" },
  { code: "ja-JP", label: "日本語 (日本)", dir: "ltr" },
  { code: "ko-KR", label: "한국어 (대한민국)", dir: "ltr" },
  { code: "nb-NO", label: "Norsk bokmål (Norge)", dir: "ltr" },
  { code: "nl-NL", label: "Nederlands (Nederland)", dir: "ltr" },
  { code: "pl-PL", label: "Polski (Polska)", dir: "ltr" },
  { code: "pt-BR", label: "Português (Brasil)", dir: "ltr" },
  { code: "pt-PT", label: "Português (Portugal)", dir: "ltr" },
  { code: "ru-RU", label: "Русский (Россия)", dir: "ltr" },
  { code: "sv-SE", label: "Svenska (Sverige)", dir: "ltr" },
  { code: "th-TH", label: "ไทย", dir: "ltr" },
  { code: "tr-TR", label: "Türkçe (Türkiye)", dir: "ltr" },
  { code: "uk-UA", label: "Українська (Україна)", dir: "ltr" },
  { code: "vi-VN", label: "Tiếng Việt (Việt Nam)", dir: "ltr" },
  { code: "zh-CN", label: "简体中文 (中国大陆)", dir: "ltr" },
  { code: "zh-HK", label: "繁體中文 (香港)", dir: "ltr" },
  { code: "zh-TW", label: "繁體中文 (台灣)", dir: "ltr" },
];

const dictionaries: Record<SupportedLocale, TranslationSchema> = {
  "en-US": enUS,
  ar,
  "cs-CZ": csCZ,
  "da-DK": daDK,
  "de-DE": deDE,
  "el-GR": elGR,
  "es-ES": esES,
  "fa-IR": faIR,
  "fi-FI": fiFI,
  "fr-FR": frFR,
  "hi-IN": hiIN,
  "hu-HU": huHU,
  "id-ID": idID,
  "is-IS": isIS,
  "it-IT": itIT,
  "ja-JP": jaJP,
  "ko-KR": koKR,
  "nb-NO": nbNO,
  "nl-NL": nlNL,
  "pl-PL": plPL,
  "pt-BR": ptBR,
  "pt-PT": ptPT,
  "ru-RU": ruRU,
  "sv-SE": svSE,
  "th-TH": thTH,
  "tr-TR": trTR,
  "uk-UA": ukUA,
  "vi-VN": viVN,
  "zh-CN": zhCN,
  "zh-HK": zhHK,
  "zh-TW": zhTW,
};

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
    // Arabic is listed without a region, so "ar-EG" and the rest must not fall through to English
    if (tag.language === "ar") return "ar";
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
  return locale === "ar" || locale === "fa-IR" ? "rtl" : "ltr";
}
