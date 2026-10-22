import type { SupportedLocale } from "@/i18n";
import sampleArSA from "./documents/ar-SA.md?raw";
import sampleDeDE from "./documents/de-DE.md?raw";
import sampleEnUS from "./documents/en-US.md?raw";
import sampleEsES from "./documents/es-ES.md?raw";
import sampleFrFR from "./documents/fr-FR.md?raw";
import sampleItIT from "./documents/it-IT.md?raw";
import sampleJaJP from "./documents/ja-JP.md?raw";
import sampleKoKR from "./documents/ko-KR.md?raw";
import samplePtBR from "./documents/pt-BR.md?raw";
import sampleRuRU from "./documents/ru-RU.md?raw";
import sampleZhCN from "./documents/zh-CN.md?raw";
import sampleZhTW from "./documents/zh-TW.md?raw";

const SAMPLE_DOCUMENTS: Record<SupportedLocale, string> = {
  "ar-SA": sampleArSA,
  "de-DE": sampleDeDE,
  "en-US": sampleEnUS,
  "es-ES": sampleEsES,
  "fr-FR": sampleFrFR,
  "it-IT": sampleItIT,
  "ja-JP": sampleJaJP,
  "ko-KR": sampleKoKR,
  "pt-BR": samplePtBR,
  "ru-RU": sampleRuRU,
  "zh-CN": sampleZhCN,
  "zh-TW": sampleZhTW,
};

export function getSampleDocument(locale: SupportedLocale): string {
  return SAMPLE_DOCUMENTS[locale];
}
