const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Text for an HTML text node or a quoted attribute: the characters a browser would otherwise read
 * as markup. Both quoting styles are escaped, so a value can go into either one.
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}
