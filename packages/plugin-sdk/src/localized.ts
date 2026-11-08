/**
 * Text the host shows on a plugin's behalf: one string for every locale, or English with the
 * locales the plugin translates. The text belongs to the plugin, so the app's dictionaries never
 * carry another package's words.
 */
export type LocalizedText = string | ({ en: string } & Readonly<Record<string, string>>);

/**
 * The text in `locale`, falling back to the language without its region and then to English. Tags
 * are compared without case, since BCP 47 is case-insensitive and a plugin may spell `zh-CN` its
 * own way.
 */
export function localize(text: LocalizedText, locale: string): string {
  if (typeof text === "string") return text;
  const wanted = locale.toLowerCase();
  const language = wanted.split("-")[0] ?? wanted;
  const entries = Object.entries(text);
  const exact = entries.find(([key]) => key.toLowerCase() === wanted);
  if (exact !== undefined) return exact[1];
  const base = entries.find(([key]) => key.toLowerCase() === language);
  return base?.[1] ?? text.en;
}
