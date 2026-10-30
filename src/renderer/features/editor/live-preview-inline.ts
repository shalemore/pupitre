import { Decoration, type EditorView, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { ImageWidget } from "@/features/editor/images/image-widget";
import { EmojiWidget } from "@/features/editor/widgets/emoji-widget";
import { MathWidget } from "@/features/editor/widgets/math-widget";
import { t } from "@/i18n";
import { emojiFor } from "@/lib/markdown/emoji";
import { footnoteReferences } from "@/lib/markdown/footnotes";
import { type DocumentImage, imageOf, resolveUrl } from "@/lib/markdown/images";
import { mathOf } from "@/lib/markdown/math";
import { type DecorationBuilder, touches } from "./live-preview-builder";

/**
 * The live preview of inline constructs: links, pictures, footnotes, emoji and inline math.
 */

export function visitLink(builder: DecorationBuilder, node: SyntaxNode): void {
  const [open, close] = node.getChildren("LinkMark");
  if (!open || !close) return;
  if (touches(builder.ranges, node.from, node.to)) {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (/^(?:LinkMark|URL|LinkTitle|LinkLabel)$/.test(child.name)) {
        builder.mark(child.from, child.to, "md-mark");
      }
    }
  } else {
    // Everything from the closing bracket on (destination, title, reference) goes at once,
    // including the spaces between them
    builder.hide(open.from, open.to);
    builder.hide(close.from, node.to);
  }
}

/**
 * A picture stands above its source, and the text of a Markdown image stands under it as its
 * caption: the brackets and the address are hidden until a selection touches them, when they show
 * as muted markers around the text, the way an inline format shows its own. A picture with no
 * caption keeps its source away and offers to add one under the picture. Returns whether the source
 * stays shown.
 */
export function placeImage(
  builder: DecorationBuilder,
  image: DocumentImage,
  markdown: boolean,
): boolean {
  const active = touches(builder.ranges, image.from, image.to);
  const src = resolveUrl(builder.state, image.src);
  if (markdown) {
    const line = builder.lineAt(image.from);
    const alone =
      builder.text(line.from, image.from).trim() === "" &&
      builder.text(image.to, line.to).trim() === "";
    const widget = new ImageWidget(src, image.alt, image.title, image, !active && alone, !alone);
    // `![` before the alt text, `](address)` after it
    const close = image.from + 2 + image.alt.length;
    // A picture with text around it stays in that line, as an inline picture does on a page
    if (image.alt !== "" && alone) {
      builder.decorations.push(Decoration.widget({ widget, side: -1 }).range(image.from));
      if (active) {
        builder.mark(image.from, image.from + 2, "md-mark");
        builder.mark(close, image.to, "md-mark");
      } else {
        builder.hide(image.from, image.from + 2);
        builder.hide(close, image.to);
      }
      builder.lineClass(image.from, image.from, "md-image-caption");
      return true;
    }
    if (!active) {
      builder.decorations.push(Decoration.replace({ widget }).range(image.from, image.to));
      return false;
    }
    builder.decorations.push(Decoration.widget({ widget, side: -1 }).range(image.from));
    if (image.alt !== "") {
      builder.mark(image.from, image.from + 2, "md-mark");
      builder.mark(close, image.to, "md-mark");
    }
    return true;
  }
  const widget = new ImageWidget(src, image.alt, image.title, image, !active);
  // An `<img>` tag keeps its whole source under the picture while it is edited
  if (active) {
    builder.decorations.push(Decoration.widget({ widget, side: -1 }).range(image.from));
    return true;
  }
  builder.decorations.push(Decoration.replace({ widget }).range(image.from, image.to));
  return false;
}

/** An image is shown in place of its source, and under it while the source is edited. */
export function visitImage(builder: DecorationBuilder, node: SyntaxNode): boolean {
  const image = imageOf(builder.state, node);
  // Only source the parser could not read completely is left as it is
  return image ? placeImage(builder, image, node.name === "Image") : true;
}

/** The arrows after a definition that take the reader back to each of its references. */
class FootnoteBacksWidget extends WidgetType {
  constructor(readonly targets: readonly number[]) {
    super();
  }

  override eq(other: FootnoteBacksWidget): boolean {
    return (
      other.targets.length === this.targets.length &&
      other.targets.every((target, index) => target === this.targets[index])
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const arrows = document.createElement("span");
    arrows.className = "md-footnote-backs";
    this.targets.forEach((target, index) => {
      const link = document.createElement("span");
      link.className = "md-footnote-back";
      link.append("↩");
      // The first arrow needs no counter; the others say which reference they return to
      if (index > 0) {
        const number = document.createElement("sup");
        number.textContent = String(index + 1);
        link.append(number);
      }
      link.title = t().editor.footnoteBack;
      link.setAttribute("role", "link");
      link.addEventListener("mousedown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        view.focus();
        view.dispatch({ selection: { anchor: target }, scrollIntoView: true });
      });
      arrows.append(link);
    });
    return arrows;
  }
}

/**
 * A footnote reference reads as its label in superscript, a definition starts with its label and
 * ends with an arrow back to the reference; the brackets show while the selection touches them.
 */
export function visitFootnote(builder: DecorationBuilder, node: SyntaxNode): void {
  const reference = node.name === "FootnoteReference";
  const labelFrom = node.from + 2;
  const labelTo = node.to - (reference ? 1 : 2);
  if (touches(builder.ranges, node.from, node.to)) {
    builder.mark(node.from, labelFrom, "md-mark");
    builder.mark(labelTo, node.to, "md-mark");
  } else {
    builder.hide(node.from, labelFrom);
    builder.hide(labelTo, node.to);
    builder.mark(labelFrom, labelTo, reference ? "md-footnote-ref" : "md-footnote-label");
  }
  if (reference) return;
  const targets = footnoteReferences(builder.state, builder.text(labelFrom, labelTo));
  const end = node.parent?.lastChild?.to;
  if (targets.length > 0 && end !== undefined) {
    builder.decorations.push(
      Decoration.widget({ widget: new FootnoteBacksWidget(targets), side: 1 }).range(end),
    );
  }
}

/** A `:name:` shortcode shows as its emoji away from the selection; names that are not emoji stay text. */
export function visitEmoji(builder: DecorationBuilder, node: SyntaxNode): void {
  const emoji = emojiFor(builder.text(node.from, node.to));
  if (!emoji || touches(builder.ranges, node.from, node.to)) return;
  builder.decorations.push(
    Decoration.replace({ widget: new EmojiWidget(emoji) }).range(node.from, node.to),
  );
}

/** Inline math is rendered in place, and shown as source while the selection touches it. */
export function visitInlineMath(builder: DecorationBuilder, node: SyntaxNode): void {
  const [open, close] = node.getChildren("MathMark");
  if (!open || !close) return;
  if (touches(builder.ranges, node.from, node.to)) {
    builder.mark(open.from, open.to, "md-mark");
    builder.mark(open.to, close.from, "md-math-source");
    builder.mark(close.from, close.to, "md-mark");
    return;
  }
  const { tex, display } = mathOf(builder.state, node);
  const widget = new MathWidget(tex, display);
  builder.decorations.push(Decoration.replace({ widget }).range(node.from, node.to));
}
