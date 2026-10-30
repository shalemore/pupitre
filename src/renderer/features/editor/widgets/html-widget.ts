import type { Extension } from "@codemirror/state";
import { EditorView, WidgetType } from "@codemirror/view";
import DOMPurify from "dompurify";
import { imageDom, watchHtmlImages } from "@/features/editor/images/image-widget";
import { fadeOut } from "@/features/editor/leave";
import { isLiteralText } from "@/features/editor/smart-typing";
import { VOID_TAGS, decorateHtmlBlock, openingTagAt } from "@/lib/markdown/html";
import { parseImageTag, resolveAgainst } from "@/lib/markdown/images";

/**
 * The editor side of raw HTML: closing a tag as it is typed, the line break of an inline
 * `<br>`, and the HTML block shown in place of its source.
 */

/**
 * Closes an inline HTML tag when the `>` that ends it is typed. lang-html's own handler decides
 * from the syntax tree, but Markdown only reads inline HTML once the tag is closed, so the tag
 * being typed is not in that tree yet. Block tags are left to it: they are parsed while they are
 * open, since they start a block.
 */
export function closeInlineTags(): Extension {
  return EditorView.inputHandler.of((view, from, to, text) => {
    if (text !== ">" || from !== to || view.compositionStarted || view.state.readOnly) return false;
    const tag = openingTagAt(view.state, from);
    if (tag === undefined || VOID_TAGS.has(tag.name)) return false;
    // The tag's own `<` tells whether it is written in code, math or front matter
    if (isLiteralText(view.state, tag.from + 1)) return false;
    const closing = `</${tag.name}>`;
    if (view.state.sliceDoc(from, from + closing.length).toLowerCase() === closing) return false;
    view.dispatch({
      changes: { from, insert: `>${closing}` },
      selection: { anchor: from + 1 },
      userEvent: "input.type",
      scrollIntoView: true,
    });
    return true;
  });
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

export class HtmlBlockWidget extends WidgetType {
  constructor(
    readonly source: string,
    /** Folder of the document, for relative image addresses. */
    readonly base: string | undefined,
    /** Whether the block's source is shown above it, as while the block is edited. */
    readonly editing = false,
  ) {
    super();
  }

  override eq(other: HtmlBlockWidget): boolean {
    return (
      other.source === this.source && other.base === this.base && other.editing === this.editing
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const picture = parseImageTag(this.source);
    if (picture) {
      // The source, which holds the alt text, stands in for the caption while it is shown
      return imageDom(
        view,
        resolveAgainst(this.base, picture.src),
        picture.alt,
        picture.title,
        picture,
        !this.editing,
        this.editing ? undefined : picture.alt,
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
