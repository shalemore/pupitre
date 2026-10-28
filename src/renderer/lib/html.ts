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

/**
 * The text a reader sees in an HTML fragment: tags and comments drop out, and character references
 * are decoded. The fragment is parsed in a `<template>`, whose content never runs.
 */
export function textOfHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.textContent ?? "";
}
