import { syntaxTree } from "@codemirror/language";
import {
  type EditorState,
  type Extension,
  type Range,
  type SelectionRange,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { DOCUMENT_EXTENSIONS } from "@shared/desktop-api";
import { desktop } from "@/lib/desktop";
import { pathFromFileUrl } from "@/lib/file";
import { AlertTitleWidget, alertTitles, alertType } from "./alerts";
import { fencedText } from "./block-text";
import { CodeCornerWidget, type FenceInfo } from "./code-corner";
import { collectHeadings, findHeadingByAnchor, HEADING_LEVEL } from "./document-structure";
import { EmojiWidget, emojiFor } from "./emoji";
import { footnoteTarget } from "./footnotes";
import { htmlTag, isFormattingTag, LineBreakWidget } from "./html";
import { openImageMenu } from "./image-menu";
import {
  documentBaseUrl,
  type DocumentImage,
  imageOf,
  ImageWidget,
  parseImageTag,
  resolveUrl,
} from "./images";
import { mathOf, MathWidget } from "./math";

/**
 * Typora-style live preview over plain Markdown source.
 *
 * The document is the Markdown text itself: every `#`, `**`, `>` or `-` is a real character that
 * can be selected, deleted or typed, and copying copies Markdown. This plugin only decides how
 * that text looks, from the Lezer syntax tree, with one rule for every construct:
 *
 *   The syntax markers of a construct are hidden unless a selection touches the construct; then
 *   they are shown as muted source text.
 *
 * Inline formats and code fences use the whole construct as their scope, quote and list markers
 * the line they are on, so moving into a nested list item does not reveal its parents. The content
 * of each construct is styled through `md-*` classes (see the theme contract in themes/pupitre);
 * supporting a new syntax means adding its Lezer extension and handling its nodes in `visit`.
 */

/** Nodes whose children are inline content, where inline HTML can occur. */
const INLINE_CONTAINER =
  /^(?:Paragraph|Task|(?:ATX|Setext)Heading\d|TableCell|Emphasis|StrongEmphasis|Strikethrough|Highlight|Superscript|Subscript|Link)$/;

/** The rendered content of inline formats; their markers are handled separately. */
function inlineClass(name: string): string | undefined {
  switch (name) {
    case "StrongEmphasis":
      return "md-strong";
    case "Emphasis":
      return "md-em";
    case "Strikethrough":
      return "md-strike";
    case "Highlight":
      return "md-tag md-tag-mark";
    case "Subscript":
      return "md-tag md-tag-sub";
    case "Superscript":
      return "md-tag md-tag-sup";
    case "InlineCode":
      return "md-code";
    case "Link":
    case "Autolink":
      return "md-link";
    case "Image":
      return "md-image";
    default:
      return undefined;
  }
}

/** Line classes of leaf blocks that are styled as a whole. */
function blockClass(name: string): string | undefined {
  const heading = HEADING_LEVEL.exec(name);
  if (heading) return `md-heading md-h${heading[1]}`;
  switch (name) {
    case "HorizontalRule":
      return "md-hr";
    case "FrontMatter":
      return "md-front-matter";
    case "HTMLBlock":
    case "CommentBlock":
      return "md-html";
    case "LinkReference":
      return "md-link-reference";
    case "FootnoteDefinition":
      return "md-footnote";
    default:
      return undefined;
  }
}

class BulletWidget extends WidgetType {
  override eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const bullet = document.createElement("span");
    bullet.className = "md-list-bullet";
    return bullet;
  }
}

/** A task's checkbox; clicking it edits the `[ ]` or `[x]` it stands for. */
class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }

  override eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked;
  }

  toDOM(view: EditorView): HTMLElement {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "md-task-checkbox";
    checkbox.checked = this.checked;
    checkbox.addEventListener("mousedown", (event) => {
      event.preventDefault();
      // The widget replaces "[ ]", so the character after its start is the check mark
      const pos = view.posAtDOM(checkbox) + 1;
      view.dispatch({ changes: { from: pos, to: pos + 1, insert: this.checked ? " " : "x" } });
    });
    return checkbox;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

const bullet = Decoration.replace({ widget: new BulletWidget() });
const lineBreak = new LineBreakWidget();
const hidden = Decoration.replace({});
const syntax = Decoration.mark({ class: "md-mark" });

interface LineStyle {
  classes: Set<string>;
  attributes: Record<string, string>;
  quoteDepth: number;
  listDepth: number;
  /** Leading whitespace of a list line that is replaced by the list indentation. */
  listIndent: number;
}

/** Turned on while the document is printed, when every construct shows rendered. */
export const setPrinting = StateEffect.define<boolean>();

const printing = StateField.define<boolean>({
  create: () => false,
  update: (value, tr) =>
    tr.effects.reduce(
      (current, effect) => (effect.is(setPrinting) ? effect.value : current),
      value,
    ),
});

/** Whether printing was turned on or off by this update. */
export function printingChanged(state: EditorState, previous: EditorState): boolean {
  return state.field(printing, false) !== previous.field(printing, false);
}

/** The selection ranges that reveal syntax; none while printing. */
export function revealingRanges(state: EditorState): readonly SelectionRange[] {
  return state.field(printing, false) ? [] : state.selection.ranges;
}

export function touches(ranges: readonly SelectionRange[], from: number, to: number): boolean {
  return ranges.some((range) => range.from <= to && range.to >= from);
}

/**
 * The range of whole lines a block covers. A block that shows as a rendering takes those lines, the
 * markers of a quote or a list around it included, so a cursor anywhere on them is in it.
 */
export function lineRange(state: EditorState, node: SyntaxNode): [number, number] {
  return [state.doc.lineAt(node.from).from, state.doc.lineAt(node.to).to];
}

function ancestorCount(node: SyntaxNode, name: string): number {
  let count = 0;
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.name === name) count++;
  }
  return count;
}

class DecorationBuilder {
  readonly decorations: Range<Decoration>[] = [];
  /** Starts of alert markers (`[!NOTE]`), which would otherwise read as links. */
  readonly alertMarkers = new Set<number>();
  private readonly lines = new Map<number, LineStyle>();
  readonly state: EditorState;

  constructor(
    view: EditorView,
    private readonly from: number,
    private readonly to: number,
  ) {
    this.state = view.state;
  }

  get ranges(): readonly SelectionRange[] {
    return revealingRanges(this.state);
  }

  lineAt(pos: number) {
    return this.state.doc.lineAt(pos);
  }

  /** Runs `style` for each line of a range that is inside the rendered window. */
  eachLine(from: number, to: number, style: (line: LineStyle, number: number) => void): void {
    const doc = this.state.doc;
    const first = doc.lineAt(Math.max(from, this.from)).number;
    const last = doc.lineAt(Math.min(to, this.to)).number;
    for (let number = first; number <= last; number++) {
      const start = doc.line(number).from;
      let line = this.lines.get(start);
      if (!line) {
        line = { classes: new Set(), attributes: {}, quoteDepth: 0, listDepth: 0, listIndent: 0 };
        this.lines.set(start, line);
      }
      style(line, number);
    }
  }

  lineClass(from: number, to: number, className: string): void {
    this.eachLine(from, to, (line) => {
      for (const name of className.split(" ")) line.classes.add(name);
    });
  }

  hide(from: number, to: number): void {
    if (to > from) this.decorations.push(hidden.range(from, to));
  }

  mark(from: number, to: number, className: string): void {
    if (to > from) this.decorations.push(Decoration.mark({ class: className }).range(from, to));
  }

  /** Shows the marker as muted source when `active`, hides it (and `extra` characters after it) otherwise. */
  marker(node: { from: number; to: number }, active: boolean, extra = 0): void {
    if (active) this.decorations.push(syntax.range(node.from, node.to));
    else this.hide(node.from, node.to + extra);
  }

  /** 1 when a space follows `pos`, so a hidden marker takes its separating space along. */
  spaceAfter(pos: number): number {
    return this.state.sliceDoc(pos, pos + 1) === " " ? 1 : 0;
  }

  text(from: number, to: number): string {
    return this.state.sliceDoc(from, to);
  }

  /**
   * A blank line between blocks reads as the space between them, the way the blocks would be set
   * apart once rendered; it opens up as an empty line while the selection is on it. Lines inside
   * code, HTML and front matter keep their height, since there the blank line is content.
   */
  collapseBlankLines(): void {
    const { doc } = this.state;
    if (doc.lines === 1) return;
    for (let pos = this.from; pos <= this.to;) {
      const line = doc.lineAt(pos);
      pos = line.to + 1;
      if (line.text.trim() !== "" || touches(this.ranges, line.from, line.to)) continue;
      const classes = this.lines.get(line.from)?.classes;
      if (classes && ["md-code-block", "md-html", "md-front-matter"].some((c) => classes.has(c))) {
        continue;
      }
      this.lineClass(line.from, line.from, "md-blank");
    }
  }

  finish(): DecorationSet {
    this.collapseBlankLines();
    for (const [start, line] of this.lines) {
      const leading = /^[ \t]*/.exec(this.lineAt(start).text)?.[0].length ?? 0;
      this.hide(start, start + Math.min(leading, line.listIndent));
      // Depths are exposed as attributes for selectors and as variables for indentation
      const attributes = { ...line.attributes };
      const variables: string[] = [];
      if (line.quoteDepth > 0) {
        attributes["data-quote-depth"] = String(line.quoteDepth);
        variables.push(`--md-quote-depth: ${line.quoteDepth}`);
      }
      if (line.listDepth > 0) {
        attributes["data-list-depth"] = String(line.listDepth);
        variables.push(`--md-list-depth: ${line.listDepth}`);
      }
      if (variables.length > 0) attributes["style"] = variables.join("; ");
      if (line.classes.size > 0) attributes["class"] = [...line.classes].join(" ");
      this.decorations.push(Decoration.line({ attributes }).range(start));
    }
    return Decoration.set(this.decorations, true);
  }
}

/**
 * Where the corner's picker writes the language: the rest of the opening fence line, which holds the
 * info string and nothing else. An indented block has no fence to write one into, and a fence whose
 * line the selection is on is edited as source.
 */
function fenceInfo(
  builder: DecorationBuilder,
  node: SyntaxNode,
  active: boolean,
): FenceInfo | undefined {
  const mark = node.name === "FencedCode" ? node.getChild("CodeMark") : null;
  if (!mark || active) return undefined;
  const line = builder.lineAt(mark.from);
  const tail = builder.text(mark.to, line.to);
  const word = /\S+/.exec(tail);
  const from = mark.to + (word?.index ?? 0);
  return {
    language: word?.[0] ?? "",
    from,
    to: from + (word?.[0].length ?? 0),
    tailFrom: mark.to,
    tailTo: line.to,
  };
}

function visitCodeBlock(builder: DecorationBuilder, node: SyntaxNode): void {
  const first = builder.lineAt(node.from).number;
  const last = builder.lineAt(node.to).number;
  builder.eachLine(node.from, node.to, (line, number) => {
    line.classes.add("md-code-block");
    if (number === first) line.classes.add("md-code-block-start");
    if (number === last) line.classes.add("md-code-block-end");
  });
  const active = touches(builder.ranges, ...lineRange(builder.state, node));
  const info = node.getChild("CodeInfo");
  if (node.name !== "BlockMath") {
    // Indented code keeps its indentation in the source, not in what is copied
    const code =
      node.name === "CodeBlock"
        ? builder.text(node.from, node.to).replace(/^(?: {4}|\t)/gm, "")
        : fencedText(builder.state, node);
    const widget = new CodeCornerWidget(code, fenceInfo(builder, node, active));
    builder.decorations.push(Decoration.widget({ widget, side: -1 }).range(node.from));
  }
  if (node.name === "CodeBlock") return;

  for (const fence of node.getChildren(node.name === "BlockMath" ? "MathMark" : "CodeMark")) {
    builder.marker(fence, active);
    if (!active) builder.lineClass(fence.from, fence.from, "md-syntax-line");
  }
  if (info) builder.marker(info, active);
}

function visitListItem(builder: DecorationBuilder, node: SyntaxNode): void {
  const mark = node.getChild("ListMark");
  if (!mark) return;
  const depth = ancestorCount(node, "ListItem") + 1;
  const firstLine = builder.lineAt(node.from);
  const markLine = builder.lineAt(mark.from);
  // Continuation lines are indented up to the item's content; that indentation becomes padding
  const contentColumn = mark.to - markLine.from + builder.spaceAfter(mark.to);
  builder.eachLine(node.from, node.to, (line, number) => {
    const isFirst = number === firstLine.number;
    line.listDepth = depth;
    // The marker of the first line hangs into the indentation; the others only take the depth
    if (isFirst) line.classes.add("md-list-item");
    else line.classes.delete("md-list-item");
    line.listIndent = isFirst ? mark.from - markLine.from : contentColumn;
  });

  const active = touches(builder.ranges, markLine.from, markLine.to);
  const task = mark.nextSibling?.name === "Task" ? mark.nextSibling.getChild("TaskMarker") : null;
  const marker = mark.to + builder.spaceAfter(mark.to);
  if (task && !active) {
    // A task reads as its checkbox alone, like on GitHub
    const checked = /x/i.test(builder.text(task.from, task.to));
    builder.hide(mark.from, task.from);
    builder.decorations.push(
      Decoration.replace({ widget: new CheckboxWidget(checked) }).range(task.from, task.to),
    );
    builder.lineClass(
      markLine.from,
      markLine.from,
      checked ? "md-task md-task-checked" : "md-task",
    );
  } else if (node.parent?.name === "BulletList" && !active && !task) {
    builder.decorations.push(bullet.range(mark.from, marker));
  } else {
    builder.mark(mark.from, marker, "md-list-mark");
  }
}

function visitLink(builder: DecorationBuilder, node: SyntaxNode): void {
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

/** A quote opening with `[!NOTE]` and the like is tinted, and titled away from the selection. */
function visitAlert(builder: DecorationBuilder, quote: SyntaxNode): void {
  const paragraph = quote.getChild("Paragraph");
  if (!paragraph || builder.lineAt(paragraph.from).from !== builder.lineAt(quote.from).from) return;
  const line = builder.lineAt(paragraph.from);
  const type = alertType(builder.text(paragraph.from, line.to));
  const titles = builder.state.facet(alertTitles);
  if (!type || !titles) return;
  builder.alertMarkers.add(paragraph.from);
  builder.eachLine(quote.from, quote.to, (style) => {
    style.classes.add("md-alert");
    style.attributes["data-alert"] = type;
  });
  if (touches(builder.ranges, line.from, line.to)) {
    builder.mark(paragraph.from, line.to, "md-mark");
  } else {
    const widget = new AlertTitleWidget(titles[type]);
    builder.decorations.push(Decoration.replace({ widget }).range(paragraph.from, line.to));
  }
}

/**
 * A picture takes the place of its source; while a selection touches that source, the source stays
 * and the picture follows it. Returns whether the source stays shown.
 */
function placeImage(builder: DecorationBuilder, image: DocumentImage): boolean {
  const active = touches(builder.ranges, image.from, image.to);
  const src = resolveUrl(builder.state, image.src);
  const widget = new ImageWidget(src, image.alt, image.title, image, !active);
  if (active) {
    builder.decorations.push(Decoration.widget({ widget, side: 1 }).range(image.to));
    return true;
  }
  builder.decorations.push(Decoration.replace({ widget }).range(image.from, image.to));
  return false;
}

/** An image is shown in place of its source, and under it while the source is edited. */
function visitImage(builder: DecorationBuilder, node: SyntaxNode): boolean {
  const image = imageOf(builder.state, node);
  // Only source the parser could not read completely is left as it is
  return image ? placeImage(builder, image) : true;
}

/**
 * A footnote reference reads as its label in superscript, a definition starts with its label;
 * the brackets show while the selection touches them.
 */
function visitFootnote(builder: DecorationBuilder, node: SyntaxNode): void {
  const reference = node.name === "FootnoteReference";
  const labelFrom = node.from + 2;
  const labelTo = node.to - (reference ? 1 : 2);
  if (touches(builder.ranges, node.from, node.to)) {
    builder.mark(node.from, labelFrom, "md-mark");
    builder.mark(labelTo, node.to, "md-mark");
    return;
  }
  builder.hide(node.from, labelFrom);
  builder.hide(labelTo, node.to);
  builder.mark(labelFrom, labelTo, reference ? "md-footnote-ref" : "md-footnote-label");
}

/** A `:name:` shortcode shows as its emoji away from the selection; names that are not emoji stay text. */
function visitEmoji(builder: DecorationBuilder, node: SyntaxNode): void {
  const emoji = emojiFor(builder.text(node.from, node.to));
  if (!emoji || touches(builder.ranges, node.from, node.to)) return;
  builder.decorations.push(
    Decoration.replace({ widget: new EmojiWidget(emoji) }).range(node.from, node.to),
  );
}

/** Inline math is rendered in place, and shown as source while the selection touches it. */
function visitInlineMath(builder: DecorationBuilder, node: SyntaxNode): void {
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

/**
 * Formatting tags such as `<kbd>…</kbd>` among a node's children are paired like Markdown formats:
 * away from the selection the tags are hidden and the content takes the tag's look
 * (`md-tag-kbd`). A `<br>` breaks the line. A picture written as an inline `<img>` tag reads as the
 * picture, the way the same construct is written for a width or an alignment. Tags that do not pair
 * stay source.
 */
function visitInlineHtml(builder: DecorationBuilder, node: SyntaxNode): void {
  const open: { name: string; tag: SyntaxNode }[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name !== "HTMLTag") continue;
    const source = builder.text(child.from, child.to);
    const picture = parseImageTag(source);
    if (picture) {
      // The picture is not Markdown syntax, so showing its source leaves the tag as muted text
      if (placeImage(builder, { ...picture, from: child.from, to: child.to })) {
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
    if (touches(builder.ranges, opening.from, child.to)) {
      builder.mark(opening.from, opening.to, "md-mark");
      builder.mark(child.from, child.to, "md-mark");
    } else {
      builder.hide(opening.from, opening.to);
      builder.hide(child.from, child.to);
      builder.mark(opening.to, child.from, `md-tag md-tag-${tag.name}`);
    }
  }
}

/** The syntax markers directly inside an inline format, such as `**` or `[` and `]`. */
export function markers(node: SyntaxNode): SyntaxNode[] {
  const found: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name.endsWith("Mark")) found.push(child);
  }
  return found;
}

/** Decorates one node; returns false to skip its children. */
function visit(builder: DecorationBuilder, node: SyntaxNode): boolean {
  const { name } = node;
  const block = blockClass(name);
  // A setext underline is not part of the heading's text; it is styled as syntax below
  if (block) builder.lineClass(node.from, name.startsWith("Setext") ? node.from : node.to, block);
  if (INLINE_CONTAINER.test(name)) visitInlineHtml(builder, node);
  const inline = builder.alertMarkers.has(node.from) ? undefined : inlineClass(name);
  if (inline) {
    // Only the text between the opening and closing markers, so revealed syntax is not
    // underlined or struck through along with it
    const [open, close] = markers(node);
    builder.mark(open?.from === node.from ? open.to : node.from, close?.from ?? node.to, inline);
  }

  switch (name) {
    case "FencedCode":
    case "CodeBlock":
    case "BlockMath":
      visitCodeBlock(builder, node);
      return false;
    case "InlineMath":
      visitInlineMath(builder, node);
      return false;
    case "FootnoteReference":
    case "FootnoteLabel":
      visitFootnote(builder, node);
      return false;
    case "Emoji":
      visitEmoji(builder, node);
      return false;
    case "FrontMatter": {
      // The fences read as the block's top and bottom edge; they open up with the selection in it
      const active = touches(builder.ranges, node.from, node.to);
      for (const fence of node.getChildren("FrontMatterMark")) {
        builder.marker(fence, active);
        if (!active) builder.lineClass(fence.from, fence.from, "md-syntax-line");
      }
      return false;
    }
    case "HTMLBlock":
    case "CommentBlock":
      return false;
    case "Blockquote": {
      const depth = ancestorCount(node, "Blockquote") + 1;
      builder.eachLine(node.from, node.to, (line) => {
        line.classes.add("md-quote");
        line.quoteDepth = depth;
      });
      visitAlert(builder, node);
      return true;
    }
    case "ListItem":
      visitListItem(builder, node);
      return true;
    case "HorizontalRule": {
      const active = touches(builder.ranges, node.from, node.to);
      builder.marker(node, active);
      return false;
    }
    case "Link":
      if (builder.alertMarkers.has(node.from)) return false;
      visitLink(builder, node);
      return true;
    case "Image":
      return visitImage(builder, node);
    case "URL":
      // A bare URL (GFM autolink) reads as a link; inside links it is part of the link syntax
      if (node.parent?.name !== "Link" && node.parent?.name !== "Image") {
        builder.mark(node.from, node.to, "md-link");
      }
      return false;
    case "Escape":
      builder.marker(
        { from: node.from, to: node.from + 1 },
        touches(builder.ranges, node.from, node.to),
      );
      return false;
    default:
      break;
  }

  const parent = node.parent;
  if (!parent) return true;
  switch (name) {
    case "HeaderMark": {
      const active = touches(builder.ranges, parent.from, parent.to);
      // An ATX opening marker takes its space along; a setext underline is a line of its own
      const opening = node.from === parent.from;
      builder.marker(node, active, opening ? builder.spaceAfter(node.to) : 0);
      if (!active && parent.name.startsWith("Setext")) {
        builder.lineClass(node.from, node.from, "md-syntax-line");
      }
      return false;
    }
    case "QuoteMark": {
      const line = builder.lineAt(node.from);
      builder.marker(
        node,
        touches(builder.ranges, line.from, line.to),
        builder.spaceAfter(node.to),
      );
      return false;
    }
    case "EmphasisMark":
    case "CodeMark":
    case "StrikethroughMark":
    case "HighlightMark":
    case "SubscriptMark":
    case "SuperscriptMark":
      builder.marker(node, touches(builder.ranges, parent.from, parent.to));
      return false;
    case "LinkMark":
      // Autolinks only; Link and Image handle their own markers
      if (parent.name === "Autolink") {
        builder.marker(node, touches(builder.ranges, parent.from, parent.to));
      } else if (parent.name === "Image") {
        builder.mark(node.from, node.to, "md-mark");
      }
      return false;
    case "TaskMarker":
      builder.mark(node.from, node.to, "md-mark");
      return false;
    default:
      return true;
  }
}

/** The footnote definitions are set off from the text by a rule above the first one. */
function markFootnotesStart(builder: DecorationBuilder): void {
  for (let block = syntaxTree(builder.state).topNode.firstChild; block; block = block.nextSibling) {
    if (block.name !== "FootnoteDefinition") continue;
    builder.lineClass(block.from, block.from, "md-footnotes-start");
    return;
  }
}

/** Decorates the rendered viewport, which also covers the lines a scroll brings into view. */
function buildDecorations(view: EditorView): DecorationSet {
  const { from, to } = view.viewport;
  const builder = new DecorationBuilder(view, from, to);
  syntaxTree(view.state).iterate({ from, to, enter: (node) => visit(builder, node.node) });
  markFootnotesStart(builder);
  return builder.finish();
}

/** The address of the link at `pos`. */
function linkAt(state: EditorState, pos: number): string | undefined {
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1);
    node;
    node = node.parent
  ) {
    const url = node.name === "URL" ? node : node.getChild("URL");
    if (url) return state.sliceDoc(url.from, url.to);
  }
  return undefined;
}

/** Opens web and mail links in the system browser; returns false for other addresses. */
export function openLink(href: string): boolean {
  if (!/^(?:https?|mailto):/i.test(href)) return false;
  window.open(href);
  return true;
}

/** A link to a document next to this one, which the window opens in place. */
const DOCUMENT_LINK = new RegExp(`^[^:]+\\.(?:${DOCUMENT_EXTENSIONS.join("|")})(?:#.*)?$`, "i");

/**
 * Follows a link: web addresses open in the browser, `#anchors` scroll to their heading and
 * Markdown files next to the document open in the window.
 */
function followLink(view: EditorView, href: string): boolean {
  if (openLink(href)) return true;
  if (href.startsWith("#")) {
    const heading = findHeadingByAnchor(collectHeadings(view.state), href.slice(1));
    if (!heading) return false;
    view.dispatch({
      selection: { anchor: heading.pos },
      effects: EditorView.scrollIntoView(heading.pos, { y: "start" }),
    });
    return true;
  }
  const base = view.state.facet(documentBaseUrl);
  if (!base || !DOCUMENT_LINK.test(href)) return false;
  const path = pathFromFileUrl(new URL(href, base));
  void desktop.invoke("app:dispatch", { id: "file.open-path", path });
  return true;
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        printingChanged(update.state, update.startState) ||
        syntaxTree(update.state) !== syntaxTree(update.startState)
      ) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    eventHandlers: {
      // Ctrl/Cmd+click follows a link; a plain click places the cursor to edit it. A rendered
      // footnote label follows on a plain click too, since its brackets hide the source to edit.
      mousedown(event, view) {
        const renderedFootnote =
          event.target instanceof Element &&
          event.target.closest(".md-footnote-ref, .md-footnote-label") !== null;
        if (event.button !== 0 || !(event.ctrlKey || event.metaKey || renderedFootnote)) {
          return false;
        }
        const pos = view.posAtCoords(event);
        if (pos === null) return false;
        // A footnote jumps between its reference and its definition
        const footnote = syntaxTree(view.state).resolveInner(pos, 1);
        const target = /^Footnote(?:Reference|Label)$/.test(footnote.name)
          ? footnoteTarget(view.state, footnote)
          : undefined;
        if (target !== undefined) {
          view.dispatch({ selection: { anchor: target }, scrollIntoView: true });
        } else {
          const href = linkAt(view.state, pos);
          if (!href || !followLink(view, href)) return false;
        }
        event.preventDefault();
        return true;
      },
      // A right-click on a picture offers what can be done with the file behind it
      contextmenu(event, view) {
        return openImageMenu(view, event);
      },
    },
  },
);

export const livePreview: Extension = [printing, livePreviewPlugin];
