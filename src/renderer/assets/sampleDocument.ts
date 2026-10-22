import type { SupportedLocale } from "@/i18n";
import sampleArSA from "./samples/ar-SA.md?raw";
import sampleDeDE from "./samples/de-DE.md?raw";
import sampleEnUS from "./samples/en-US.md?raw";
import sampleEsES from "./samples/es-ES.md?raw";
import sampleFrFR from "./samples/fr-FR.md?raw";
import sampleItIT from "./samples/it-IT.md?raw";
import sampleJaJP from "./samples/ja-JP.md?raw";
import sampleKoKR from "./samples/ko-KR.md?raw";
import samplePtBR from "./samples/pt-BR.md?raw";
import sampleRuRU from "./samples/ru-RU.md?raw";
import sampleZhCN from "./samples/zh-CN.md?raw";
import sampleZhTW from "./samples/zh-TW.md?raw";

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
