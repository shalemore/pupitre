/** A destination that already names its scheme, as `<https://example.com>` and `<mailto:…>` do. */
const SCHEME = /^[a-z][a-z0-9+.-]{1,31}:/i;

/** A bare host that GitHub autolinks as a web address. */
const WEB_HOST = /^www\./;

/**
 * The destination an autolink stands for. CommonMark writes an address without a scheme as a mail
 * link, GFM writes a `www.` host as a web link, and a URI keeps the scheme it was written with.
 */
export function autolinkDestination(text: string): string {
  if (SCHEME.test(text)) return text;
  if (text.includes("@")) return `mailto:${text}`;
  if (WEB_HOST.test(text)) return `http://${text}`;
  return text;
}
