import type { EditorState } from "@codemirror/state";

/**
 * Raw HTML in Markdown, read as syntax: inline formatting elements such as `<kbd>Ctrl</kbd>`,
 * the blocks that can be shown rendered, and the classes an element takes so an HTML heading,
 * link or format is drawn like the Markdown it stands for.
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

/**
 * The Markdown construct an element stands for. Its content takes the same classes as that
 * construct, so a theme styles `<strong>` and `**` in one place and both read alike.
 */
const MARKDOWN_EQUIVALENT: Readonly<Record<string, string>> = {
  b: "md-strong",
  code: "md-code",
  del: "md-strike",
  em: "md-em",
  i: "md-em",
  s: "md-strike",
  strong: "md-strong",
};

/** The classes the content of a formatting element takes, for the live preview and HTML blocks. */
export function formattingTagClass(name: string): string {
  const equivalent = MARKDOWN_EQUIVALENT[name];
  return `md-tag md-tag-${name}${equivalent === undefined ? "" : ` ${equivalent}`}`;
}

/** The name of an inline HTML tag such as `<kbd>` or `</kbd>`, and whether it closes. */
export function htmlTag(source: string): { name: string; closing: boolean } | undefined {
  const match = /^<(\/?)([a-z][a-z0-9]*)\b[^>]*>$/i.exec(source);
  const name = match?.[2]?.toLowerCase();
  return name ? { name, closing: match?.[1] === "/" } : undefined;
}

export function isFormattingTag(name: string): boolean {
  return FORMATTING_TAGS.has(name);
}

/** Elements that never take a closing tag. */
export const VOID_TAGS = new Set(
  "area base br col command embed frame hr img input keygen link meta param source track wbr".split(
    " ",
  ),
);

/**
 * An opening tag whose `>` is about to be typed, with the text that follows its name. Quoted
 * attribute values may hold `>`, so the tail is matched with its quotes closed.
 */
const OPENING_TAG = /<([a-z][\w-]*)((?:[^<>"']|"[^"]*"|'[^']*')*)$/i;

export interface OpeningTag {
  name: string;
  /** Where the `<` stands, to tell what the tag is written in. */
  from: number;
}

export function openingTagAt(state: EditorState, at: number): OpeningTag | undefined {
  const line = state.doc.lineAt(at);
  const text = state.sliceDoc(line.from, at);
  const match = OPENING_TAG.exec(text);
  const name = match?.[1]?.toLowerCase();
  const rest = match?.[2] ?? "";
  if (match === null || name === undefined) return undefined;
  // A tag written right after `](` is the angle-bracket destination of a link or an image
  if (text[match.index - 1] === "(" && text[match.index - 2] === "]") return undefined;
  if (text.endsWith("/")) return undefined;
  // A Markdown autolink is written like a tag: <scheme:…> or <user@host>
  if (rest.startsWith(":") || (!/^\s/.test(rest) && rest.includes("@"))) return undefined;
  return { name, from: line.from + match.index };
}

/** The heading levels a document styles, from the theme's h1 to its h6. */
const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

/**
 * Gives the elements of a sanitized HTML block the classes a document uses, so an HTML heading,
 * link or inline format is drawn like the Markdown it stands for. The editor and the exported page
 * both call this.
 */
export function decorateHtmlBlock(block: HTMLElement): void {
  for (const level of HEADING_LEVELS) {
    for (const heading of block.querySelectorAll(`h${level}`)) {
      heading.classList.add("md-heading", `md-h${level}`);
    }
  }
  for (const anchor of block.querySelectorAll("a")) anchor.classList.add("md-link");
  for (const tag of FORMATTING_TAGS) {
    for (const element of block.querySelectorAll(tag)) {
      for (const name of formattingTagClass(tag).split(" ")) element.classList.add(name);
    }
  }
}

/**
 * Elements whose content never becomes visible text: the sanitizer drops it together with the
 * element, so a block that opens with one would hide its source behind nothing. An unclosed
 * `<script>` or `<style>` runs to the end of the document, which would swallow everything after it.
 */
const HIDDEN_CONTENT_TAGS = new Set([
  "head",
  "iframe",
  "noembed",
  "noframes",
  "noscript",
  "plaintext",
  "script",
  "style",
  "template",
  "title",
  "xmp",
]);

/** Whether an HTML block is an element that can be shown rendered. */
export function isRenderableHtml(source: string): boolean {
  const tag = /^<([a-z][a-z0-9]*)[\s/>]/i.exec(source)?.[1]?.toLowerCase();
  return tag !== undefined && tag !== "details" && !HIDDEN_CONTENT_TAGS.has(tag);
}
