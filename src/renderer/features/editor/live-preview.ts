import { syntaxTree } from "@codemirror/language";
import type { EditorSelection, EditorState, Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

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

const HEADING = /^(?:ATX|Setext)Heading([1-6])$/;

/** The rendered content of inline formats; their markers are handled separately. */
function inlineClass(name: string): string | undefined {
  switch (name) {
    case "StrongEmphasis":
      return "md-strong";
    case "Emphasis":
      return "md-em";
    case "Strikethrough":
      return "md-strike";
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
  const heading = HEADING.exec(name);
  if (heading) return `md-heading md-h${heading[1]}`;
  switch (name) {
    case "HorizontalRule":
      return "md-hr";
    case "Table":
      return "md-table";
    case "FrontMatter":
      return "md-front-matter";
    case "HTMLBlock":
    case "CommentBlock":
      return "md-html";
    case "LinkReference":
      return "md-link-reference";
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

const bullet = Decoration.replace({ widget: new BulletWidget() });
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

function touches(selection: EditorSelection, from: number, to: number): boolean {
  return selection.ranges.some((range) => range.from <= to && range.to >= from);
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
  private readonly lines = new Map<number, LineStyle>();
  private readonly state: EditorState;

  constructor(
    view: EditorView,
    private readonly from: number,
    private readonly to: number,
  ) {
    this.state = view.state;
  }

  get selection(): EditorSelection {
    return this.state.selection;
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

  finish(): DecorationSet {
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

function visitCodeBlock(builder: DecorationBuilder, node: SyntaxNode): void {
  const first = builder.lineAt(node.from).number;
  const last = builder.lineAt(node.to).number;
  builder.eachLine(node.from, node.to, (line, number) => {
    line.classes.add("md-code-block");
    if (number === first) line.classes.add("md-code-block-start");
    if (number === last) line.classes.add("md-code-block-end");
  });
  if (node.name !== "FencedCode") return;

  const active = touches(builder.selection, node.from, node.to);
  const info = node.getChild("CodeInfo");
  for (const fence of node.getChildren("CodeMark")) {
    builder.marker(fence, active);
    if (!active) builder.lineClass(fence.from, fence.from, "md-syntax-line");
  }
  if (!info) return;
  builder.marker(info, active);
  if (!active) {
    const language = builder.text(info.from, info.to);
    builder.eachLine(info.from, info.from, (line) => (line.attributes["data-language"] = language));
  }
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
    line.classes.delete(isFirst ? "md-list-continuation" : "md-list-item");
    line.classes.add(isFirst ? "md-list-item" : "md-list-continuation");
    line.listIndent = isFirst ? mark.from - markLine.from : contentColumn;
  });

  const active = touches(builder.selection, markLine.from, markLine.to);
  const isTask = mark.nextSibling?.name === "Task";
  const marker = mark.to + builder.spaceAfter(mark.to);
  if (node.parent?.name === "BulletList" && !active && !isTask) {
    builder.decorations.push(bullet.range(mark.from, marker));
  } else {
    builder.mark(mark.from, marker, "md-list-mark");
  }
}

function visitLink(builder: DecorationBuilder, node: SyntaxNode): void {
  const [open, close] = node.getChildren("LinkMark");
  if (!open || !close) return;
  if (touches(builder.selection, node.from, node.to)) {
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

/** The syntax markers directly inside an inline format, such as `**` or `[` and `]`. */
function markers(node: SyntaxNode): SyntaxNode[] {
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
  const inline = inlineClass(name);
  if (inline) {
    // Only the text between the opening and closing markers, so revealed syntax is not
    // underlined or struck through along with it
    const [open, close] = markers(node);
    builder.mark(open?.from === node.from ? open.to : node.from, close?.from ?? node.to, inline);
  }

  switch (name) {
    case "FencedCode":
    case "CodeBlock":
      visitCodeBlock(builder, node);
      return false;
    case "FrontMatter":
      for (const fence of node.getChildren("FrontMatterMark")) {
        builder.mark(fence.from, fence.to, "md-mark");
      }
      return false;
    case "HTMLBlock":
    case "CommentBlock":
      return false;
    case "Blockquote": {
      const depth = ancestorCount(node, "Blockquote") + 1;
      builder.eachLine(node.from, node.to, (line) => {
        line.classes.add("md-quote");
        line.quoteDepth = depth;
      });
      return true;
    }
    case "ListItem":
      visitListItem(builder, node);
      return true;
    case "HorizontalRule": {
      const active = touches(builder.selection, node.from, node.to);
      builder.marker(node, active);
      return false;
    }
    case "Link":
      visitLink(builder, node);
      return true;
    case "URL":
      // A bare URL (GFM autolink) reads as a link; inside links it is part of the link syntax
      if (node.parent?.name !== "Link" && node.parent?.name !== "Image") {
        builder.mark(node.from, node.to, "md-link");
      }
      return false;
    case "Escape":
      builder.marker(
        { from: node.from, to: node.from + 1 },
        touches(builder.selection, node.from, node.to),
      );
      return false;
    default:
      break;
  }

  const parent = node.parent;
  if (!parent) return true;
  switch (name) {
    case "HeaderMark": {
      const active = touches(builder.selection, parent.from, parent.to);
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
        touches(builder.selection, line.from, line.to),
        builder.spaceAfter(node.to),
      );
      return false;
    }
    case "EmphasisMark":
    case "CodeMark":
    case "StrikethroughMark":
      builder.marker(node, touches(builder.selection, parent.from, parent.to));
      return false;
    case "LinkMark":
      // Autolinks only; Link and Image handle their own markers
      if (parent.name === "Autolink") {
        builder.marker(node, touches(builder.selection, parent.from, parent.to));
      } else if (parent.name === "Image") {
        builder.mark(node.from, node.to, "md-mark");
      }
      return false;
    case "TableDelimiter":
    case "TaskMarker":
      builder.mark(node.from, node.to, "md-mark");
      return false;
    default:
      return true;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const ranges = view.visibleRanges;
  const from = ranges[0]?.from ?? 0;
  const to = ranges.at(-1)?.to ?? 0;
  const builder = new DecorationBuilder(view, from, to);
  syntaxTree(view.state).iterate({ from, to, enter: (node) => visit(builder, node.node) });
  return builder.finish();
}

/** The address of the link at `pos`, for links with an absolute URL. */
function linkAt(state: EditorState, pos: number): string | undefined {
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1);
    node;
    node = node.parent
  ) {
    const url = node.name === "URL" ? node : node.getChild("URL");
    if (!url) continue;
    const href = state.sliceDoc(url.from, url.to);
    return /^(?:https?|mailto):/i.test(href) ? href : undefined;
  }
  return undefined;
}

export const livePreview = ViewPlugin.fromClass(
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
        syntaxTree(update.state) !== syntaxTree(update.startState)
      ) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    eventHandlers: {
      // Ctrl/Cmd+click follows a link; a plain click places the cursor to edit it
      mousedown(event, view) {
        if (event.button !== 0 || !(event.ctrlKey || event.metaKey)) return false;
        const pos = view.posAtCoords(event);
        const href = pos === null ? undefined : linkAt(view.state, pos);
        if (!href) return false;
        event.preventDefault();
        window.open(href);
        return true;
      },
    },
  },
);
