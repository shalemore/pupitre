import { type EditorView, WidgetType } from "@codemirror/view";
import DOMPurify from "dompurify";
import { imageDom, parseImageTag, resolveAgainst, watchHtmlImages } from "./images";

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
    block.append(DOMPurify.sanitize(this.source, { RETURN_DOM_FRAGMENT: true }));
    // Preflight leaves headings without their size and weight, so give them the document's styles
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      for (const heading of block.querySelectorAll(`h${level}`)) {
        heading.classList.add("md-heading", `md-h${level}`);
      }
    }
    watchHtmlImages(view, block, this.base);
    return block;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}
