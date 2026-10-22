import type { SupportedLocale } from "@/i18n";
import sampleAr from "./documents/ar.md?raw";
import sampleCsCZ from "./documents/cs-CZ.md?raw";
import sampleDaDK from "./documents/da-DK.md?raw";
import sampleDeDE from "./documents/de-DE.md?raw";
import sampleElGR from "./documents/el-GR.md?raw";
import sampleEnUS from "./documents/en-US.md?raw";
import sampleEsES from "./documents/es-ES.md?raw";
import sampleFaIR from "./documents/fa-IR.md?raw";
import sampleFiFI from "./documents/fi-FI.md?raw";
import sampleFrFR from "./documents/fr-FR.md?raw";
import sampleHiIN from "./documents/hi-IN.md?raw";
import sampleHuHU from "./documents/hu-HU.md?raw";
import sampleIdID from "./documents/id-ID.md?raw";
import sampleIsIS from "./documents/is-IS.md?raw";
import sampleItIT from "./documents/it-IT.md?raw";
import sampleJaJP from "./documents/ja-JP.md?raw";
import sampleKoKR from "./documents/ko-KR.md?raw";
import sampleNbNO from "./documents/nb-NO.md?raw";
import sampleNlNL from "./documents/nl-NL.md?raw";
import samplePlPL from "./documents/pl-PL.md?raw";
import samplePtBR from "./documents/pt-BR.md?raw";
import samplePtPT from "./documents/pt-PT.md?raw";
import sampleRuRU from "./documents/ru-RU.md?raw";
import sampleSvSE from "./documents/sv-SE.md?raw";
import sampleThTH from "./documents/th-TH.md?raw";
import sampleTrTR from "./documents/tr-TR.md?raw";
import sampleUkUA from "./documents/uk-UA.md?raw";
import sampleViVN from "./documents/vi-VN.md?raw";
import sampleZhCN from "./documents/zh-CN.md?raw";
import sampleZhHK from "./documents/zh-HK.md?raw";
import sampleZhTW from "./documents/zh-TW.md?raw";

const SAMPLE_DOCUMENTS: Record<SupportedLocale, string> = {
  ar: sampleAr,
  "cs-CZ": sampleCsCZ,
  "da-DK": sampleDaDK,
  "de-DE": sampleDeDE,
  "el-GR": sampleElGR,
  "en-US": sampleEnUS,
  "es-ES": sampleEsES,
  "fa-IR": sampleFaIR,
  "fi-FI": sampleFiFI,
  "fr-FR": sampleFrFR,
  "hi-IN": sampleHiIN,
  "hu-HU": sampleHuHU,
  "id-ID": sampleIdID,
  "is-IS": sampleIsIS,
  "it-IT": sampleItIT,
  "ja-JP": sampleJaJP,
  "ko-KR": sampleKoKR,
  "nb-NO": sampleNbNO,
  "nl-NL": sampleNlNL,
  "pl-PL": samplePlPL,
  "pt-BR": samplePtBR,
  "pt-PT": samplePtPT,
  "ru-RU": sampleRuRU,
  "sv-SE": sampleSvSE,
  "th-TH": sampleThTH,
  "tr-TR": sampleTrTR,
  "uk-UA": sampleUkUA,
  "vi-VN": sampleViVN,
  "zh-CN": sampleZhCN,
  "zh-HK": sampleZhHK,
  "zh-TW": sampleZhTW,
};

export function getSampleDocument(locale: SupportedLocale): string {
  return SAMPLE_DOCUMENTS[locale];
}
