import { type EditorView, WidgetType } from "@codemirror/view";
import DOMPurify from "dompurify";
import { imageDom, parseImageTag, resolveAgainst, watchHtmlImages } from "./images";
import { fadeOut } from "./leave";

/**
 * Raw HTML in Markdown. Inline formatting elements such as `<kbd>Ctrl</kbd>` are shown with
 * their tags hidden away from the selection, like Markdown formats; other inline tags stay source.
 * HTML blocks that start with an element are rendered, sanitized with DOMPurify; comments and
 * closing tags stay source. A block that holds nothing but an `<img>` tag is the picture a resize
 * writes, shown as that picture so that it can be resized and aligned again.
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

export class HtmlBlockWidget extends WidgetType {
  constructor(
    readonly source: string,
    /** Folder of the document, for relative image addresses. */
    readonly base: string | undefined,
  ) {
    super();
  }

  override eq(other: HtmlBlockWidget): boolean {
    return other.source === this.source && other.base === this.base;
  }

  toDOM(view: EditorView): HTMLElement {
    const picture = parseImageTag(this.source);
    if (picture) {
      return imageDom(
        view,
        resolveAgainst(this.base, picture.src),
        picture.alt,
        picture.title,
        picture,
        true,
        picture.alt,
      );
    }
    const block = document.createElement("div");
    block.className = "md-html-block";
    this.fill(block, view);
    return block;
  }

  /** The block under the selection is rebuilt as its source is typed, in the element that stands. */
  override updateDOM(dom: HTMLElement, view: EditorView): boolean {
    if (!dom.classList.contains("md-html-block")) return false;
    this.fill(dom, view);
    return true;
  }

  override ignoreEvent(): boolean {
    return false;
  }

  override destroy(dom: HTMLElement): void {
    // A block that is only a picture stands as that picture, which needs no fading of its own
    if (dom.classList.contains("md-html-block")) fadeOut(dom);
  }

  private fill(block: HTMLElement, view: EditorView): void {
    block.replaceChildren(DOMPurify.sanitize(this.source, { RETURN_DOM_FRAGMENT: true }));
    decorateHtmlBlock(block);
    watchHtmlImages(view, block, this.base);
  }
}
