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

/**
 * The page with every script taken out: the image export loads it in a window that only measures
 * it, so nothing in the document may run. A page the editor builds carries no script; one that
 * does is parsed and stripped rather than trusted.
 */
export function withoutScripts(page: string): string {
  if (!/<script/i.test(page)) return page;
  const parsed = new DOMParser().parseFromString(page, "text/html");
  for (const script of parsed.querySelectorAll("script")) script.remove();
  return `<!doctype html>\n${parsed.documentElement.outerHTML}`;
}
