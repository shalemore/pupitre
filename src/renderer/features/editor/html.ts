import { type EditorView, WidgetType } from "@codemirror/view";
import DOMPurify from "dompurify";
import { imageDom, parseImageTag, resolveAgainst } from "./images";

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

/** Whether an HTML block is an element that can be shown rendered. */
export function isRenderableHtml(source: string): boolean {
  return /^<[a-z]/i.test(source) && !/^<details[\s>]/i.test(source);
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
      return imageDom(view, resolveAgainst(this.base, picture.src), picture.alt, picture, true);
    }
    const block = document.createElement("div");
    block.className = "md-html-block";
    block.append(DOMPurify.sanitize(this.source, { RETURN_DOM_FRAGMENT: true }));
    for (const image of block.querySelectorAll("img")) {
      image.src = resolveAgainst(this.base, image.getAttribute("src") ?? "");
    }
    return block;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}
