import { createMemo, createSignal } from "solid-js";
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
import type {
  Direction,
  LanguageSetting,
  LocaleMeta,
  SupportedLocale,
  TranslationSchema,
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
] as const;

export const RTL_LOCALES: ReadonlySet<SupportedLocale> = new Set<SupportedLocale>(["ar-SA"]);

const dictionaries: Record<SupportedLocale, TranslationSchema> = {
  "en-US": enUS,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  "ja-JP": jaJP,
  "ko-KR": koKR,
  "es-ES": esES,
  "fr-FR": frFR,
  "de-DE": deDE,
  "ru-RU": ruRU,
  "pt-BR": ptBR,
  "it-IT": itIT,
  "ar-SA": arSA,
};

const STORAGE_KEY = "pupitre-language-setting";

/**
 * Detect supported locale from navigator.language; falls back to en-US.
 */
export function detectSystemLocale(): SupportedLocale {
  if (typeof navigator === "undefined" || !navigator.language) {
    return DEFAULT_FALLBACK_LOCALE;
  }

  const rawLang = navigator.language.toLowerCase();

  // Normalize Chinese variants
  if (rawLang.startsWith("zh")) {
    if (rawLang.includes("tw") || rawLang.includes("hk") || rawLang.includes("hant")) {
      return "zh-TW";
    }
    return "zh-CN";
  }

  // Exact match
  const exactMatch = SUPPORTED_LOCALES.find((item) => item.code.toLowerCase() === rawLang);
  if (exactMatch) {
    return exactMatch.code;
  }

  // Primary language prefix match (e.g. en-GB -> en-US, pt-PT -> pt-BR)
  const primaryLang = rawLang.split(/[-_]/)[0];
  const primaryMatch = SUPPORTED_LOCALES.find((item) =>
    item.code.toLowerCase().startsWith(`${primaryLang}-`),
  );
  if (primaryMatch) {
    return primaryMatch.code;
  }

  return DEFAULT_FALLBACK_LOCALE;
}

function getStoredSetting(): LanguageSetting {
  if (typeof localStorage === "undefined") {
    return "auto";
  }
  const val = localStorage.getItem(STORAGE_KEY);
  if (val === "auto") return "auto";
  if (val && val in dictionaries) {
    return val as SupportedLocale;
  }
  return "auto";
}

const [languageSettingSignal, setLanguageSettingSignal] =
  createSignal<LanguageSetting>(getStoredSetting());

export const currentLocale = createMemo<SupportedLocale>(() => {
  const setting = languageSettingSignal();
  if (setting === "auto") {
    return detectSystemLocale();
  }
  return setting;
});

export const currentDirection = createMemo<Direction>(() => {
  return RTL_LOCALES.has(currentLocale()) ? "rtl" : "ltr";
});

export const isRTL = createMemo<boolean>(() => currentDirection() === "rtl");

export const t = createMemo<TranslationSchema>(() => {
  return dictionaries[currentLocale()] ?? dictionaries[DEFAULT_FALLBACK_LOCALE];
});

function syncDomAttributes(locale: SupportedLocale) {
  if (typeof document === "undefined") return;
  const dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
  document.documentElement.dir = dir;
  document.documentElement.lang = locale;
}

export function setLanguageSetting(setting: LanguageSetting) {
  setLanguageSettingSignal(setting);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, setting);
  }
  const resolved = setting === "auto" ? detectSystemLocale() : setting;
  syncDomAttributes(resolved);
}

export { languageSettingSignal as languageSetting };

if (typeof document !== "undefined") {
  syncDomAttributes(currentLocale());
}
