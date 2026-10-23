import { WidgetType } from "@codemirror/view";

/**
 * Raw HTML in Markdown. Inline formatting elements such as `<kbd>Ctrl</kbd>` are shown with
 * their tags hidden away from the selection, like Markdown formats; other tags stay source.
 */

/** Inline HTML elements that format text. */
const FORMATTING_TAGS = new Set([
  "b",
  "code",
  "del",
  "em",
  "i",
  "ins",
  "kbd",
  "mark",
  "s",
  "small",
  "strong",
  "sub",
  "sup",
  "u",
]);

/** The name of an inline HTML tag such as `<kbd>` or `</kbd>`, and whether it closes. */
export function htmlTag(source: string): { name: string; closing: boolean } | undefined {
  const match = /^<(\/?)([a-z][a-z0-9]*)\b[^>]*>$/i.exec(source);
  const name = match?.[2]?.toLowerCase();
  return name ? { name, closing: match?.[1] === "/" } : undefined;
}

export function isFormattingTag(name: string): boolean {
  return FORMATTING_TAGS.has(name);
}

export class LineBreakWidget extends WidgetType {
  override eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    return document.createElement("br");
  }

  override ignoreEvent(): boolean {
    return false;
  }
}
