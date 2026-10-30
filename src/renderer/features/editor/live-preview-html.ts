import { Decoration } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { LineBreakWidget } from "@/features/editor/widgets/html-widget";
import { formattingTagClass, htmlTag, isFormattingTag } from "@/lib/markdown/html";
import type { HtmlElement } from "@/lib/markdown/html-block";
import { parseImageTag } from "@/lib/markdown/images";
import { type DecorationBuilder, touches } from "./live-preview-builder";
import { placeImage } from "./live-preview-inline";

/**
 * The live preview of raw HTML: formatting tags paired like Markdown formats, the inline line
 * break, and the simple blocks drawn in place.
 */

const lineBreak = new LineBreakWidget();
const htmlSyntax = Decoration.mark({ class: "md-html-mark" });

/**
 * Formatting tags such as `<kbd>…</kbd>` among a node's children are paired like Markdown formats:
 * away from the selection the tags are hidden and the content takes the tag's look
 * (`md-tag-kbd`). A `<br>` breaks the line. A picture written as an inline `<img>` tag reads as the
 * picture, the way the same construct is written for a width or an alignment. Tags that do not pair
 * stay source.
 */
export function visitInlineHtml(builder: DecorationBuilder, node: SyntaxNode): void {
  const open: { name: string; tag: SyntaxNode }[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name !== "HTMLTag") continue;
    const source = builder.text(child.from, child.to);
    const picture = parseImageTag(source);
    if (picture) {
      // The picture is not Markdown syntax, so showing its source leaves the tag as muted text
      if (placeImage(builder, { ...picture, from: child.from, to: child.to }, false)) {
        builder.mark(child.from, child.to, "md-mark");
      }
      continue;
    }
    const tag = htmlTag(source);
    if (!tag) continue;
    if (tag.name === "br") {
      if (!touches(builder.ranges, child.from, child.to)) {
        builder.decorations.push(
          Decoration.replace({ widget: lineBreak }).range(child.from, child.to),
        );
      }
      continue;
    }
    if (!isFormattingTag(tag.name)) continue;
    if (!tag.closing) {
      open.push({ name: tag.name, tag: child });
      continue;
    }
    const index = open.findLastIndex((entry) => entry.name === tag.name);
    const opening = open[index]?.tag;
    if (!opening) continue;
    open.splice(index);
    // The content keeps the tag's look while the tags are shown, as text between `**` keeps its
    // weight while the markers are edited
    builder.mark(opening.to, child.from, formattingTagClass(tag.name));
    if (touches(builder.ranges, opening.from, child.to)) {
      builder.mark(opening.from, opening.to, "md-mark");
      builder.mark(child.from, child.to, "md-mark");
    } else {
      builder.hide(opening.from, opening.to);
      builder.hide(child.from, child.to);
    }
  }
}

/** The class an inline HTML tag takes so it reads like the Markdown it stands for. */
function htmlInlineClass(tag: string): string {
  return tag === "a" ? "md-link" : `md-tag md-tag-${tag}`;
}

/** A tag of a native HTML block: shown as source while the selection touches it, hidden otherwise. */
function htmlMarker(
  builder: DecorationBuilder,
  base: number,
  range: { from: number; to: number },
  active: boolean,
): void {
  builder.marker({ from: base + range.from, to: base + range.to }, active, 0, htmlSyntax);
}

function visitHtmlInline(builder: DecorationBuilder, base: number, element: HtmlElement): void {
  const from = base + element.startTag.from;
  const to = base + (element.endTag?.to ?? element.content.to);
  const active = touches(builder.ranges, from, to);
  htmlMarker(builder, base, element.startTag, active);
  if (element.endTag !== undefined) htmlMarker(builder, base, element.endTag, active);
  if (!active) {
    builder.mark(
      base + element.content.from,
      base + element.content.to,
      htmlInlineClass(element.tag),
    );
  }
  for (const child of element.children) visitHtmlInline(builder, base, child);
}

/**
 * A simple HTML block drawn in place: its tags hide unless the selection touches the element, its
 * heading takes the heading line's classes, and its alignment and inline children read like their
 * Markdown counterparts.
 */
export function visitHtmlBlock(
  builder: DecorationBuilder,
  node: SyntaxNode,
  element: HtmlElement,
): void {
  const base = node.from;
  const from = base + element.startTag.from;
  const to = base + (element.endTag?.to ?? element.content.to);
  const active = touches(builder.ranges, from, to);
  htmlMarker(builder, base, element.startTag, active);
  if (element.endTag !== undefined) htmlMarker(builder, base, element.endTag, active);
  const level = /^h([1-6])$/.exec(element.tag)?.[1];
  if (level !== undefined) builder.lineClass(from, to, `md-heading md-h${level}`);
  if (element.alignment !== undefined) {
    builder.eachLine(from, to, (line) => {
      const alignment = `text-align: ${element.alignment}`;
      line.attributes["style"] =
        line.attributes["style"] === undefined
          ? alignment
          : `${line.attributes["style"]}; ${alignment}`;
    });
  }
  for (const child of element.children) visitHtmlInline(builder, base, child);
}
