import type { SupportedLocale } from "@/i18n";

/**
 * The example document for each language, loaded when one is opened. They are raw files rather
 * than code, and keeping thirty of them out of the entry bundle shortens the first paint.
 */
const SAMPLE_DOCUMENTS = import.meta.glob<string>("./documents/*.md", {
  query: "?raw",
  import: "default",
});

export async function getSampleDocument(locale: SupportedLocale): Promise<string> {
  const load = SAMPLE_DOCUMENTS[`./documents/${locale}.md`];
  if (load === undefined) throw new Error(`No sample document for ${locale}`);
  return load();
}
