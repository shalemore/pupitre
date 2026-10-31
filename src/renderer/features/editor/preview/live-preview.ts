import { syntaxTree } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { openImageMenu } from "@/features/editor/images/image-menu";
import { detailsAnimationChanged } from "@/lib/markdown/details";
import { footnoteTarget } from "@/lib/markdown/footnotes";
import { htmlBlockPreview } from "@/lib/markdown/html-block";
import { parseImageTag } from "@/lib/markdown/images";
import { markers } from "@/lib/markdown/markers";
import { HEADING_LEVEL } from "@/lib/markdown/structure";
import { showsRendering, visitBlockquote, visitCodeBlock, visitListItem } from "./blocks";
import { DecorationBuilder, lineRange, printing, printingChanged, touches } from "./builder";
import { visitHtmlBlock, visitInlineHtml } from "./html";
import { visitEmoji, visitFootnote, visitImage, visitInlineMath, visitLink } from "./inline";
import { followLink, linkAt } from "./links";

export { setPrinting } from "./builder";

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
 * of each construct is styled through `md-*` classes (see the `theming-pupitre` skill);
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

/** Decorates one node; returns false to skip its children. */
function visit(builder: DecorationBuilder, node: SyntaxNode): boolean {
  const { name } = node;
  if (name === "FootnoteDefinition") builder.hasFootnoteDefinition = true;
  // A simple HTML heading or paragraph is drawn in place; anything else stays a rendered block
  const source = name === "HTMLBlock" ? builder.text(node.from, node.to) : undefined;
  const html = source === undefined ? undefined : htmlBlockPreview(source);
  // A picture written as an `<img>` tag keeps the caption line a Markdown picture shows
  const picture = source !== undefined && parseImageTag(source) !== undefined;
  const block = html !== undefined ? undefined : picture ? "md-image-source" : blockClass(name);
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
      if (html !== undefined) visitHtmlBlock(builder, node, html.element);
      return false;
    case "CommentBlock":
      return false;
    case "Blockquote":
      visitBlockquote(builder, node);
      return true;
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
  if (!builder.hasFootnoteDefinition) return;
  for (let block = syntaxTree(builder.state).topNode.firstChild; block; block = block.nextSibling) {
    if (block.from > builder.to) return;
    if (block.name !== "FootnoteDefinition") continue;
    builder.lineClass(block.from, block.from, "md-footnotes-start");
    return;
  }
}

/** Decorates the rendered viewport, which also covers the lines a scroll brings into view. */
function buildDecorations(
  view: EditorView,
  growing: ReadonlySet<number> = new Set(),
): DecorationSet {
  const { from, to } = view.viewport;
  const builder = new DecorationBuilder(view, from, to, growing);
  syntaxTree(view.state).iterate({ from, to, enter: (node) => visit(builder, node.node) });
  markFootnotesStart(builder);
  return builder.finish();
}

/**
 * The empty lines an edit just opened inside a code block. They grow into place rather than jump,
 * which is the only way a code block can be seen to get taller: CodeMirror measures the height of
 * its lines, so the line itself has to carry the movement.
 */
function growingLines(update: ViewUpdate): ReadonlySet<number> {
  const lines = new Set<number>();
  if (!update.docChanged) return lines;
  update.changes.iterChangedRanges((_fromA, _toA, _fromB, toB) => {
    const line = update.state.doc.lineAt(toB);
    if (line.text.trim() !== "") return;
    let node: SyntaxNode | null = syntaxTree(update.state).resolveInner(toB, 1);
    for (; node; node = node.parent) {
      if (node.name === "FencedCode" || node.name === "CodeBlock") {
        lines.add(line.from);
        return;
      }
    }
  });
  return lines;
}

/**
 * The source lines of a rendering the selection has just opened. They unfold under the rendering,
 * which keeps the place it had while it was closed; the first line holds the rendering itself and
 * stays still.
 */
function openingLines(update: ViewUpdate): ReadonlySet<number> {
  const lines = new Set<number>();
  if (!update.selectionSet) return lines;
  const before = update.startState.selection.ranges;
  const now = update.state.selection.ranges;
  syntaxTree(update.state).iterate({
    enter: (node) => {
      if (node.name !== "BlockMath" && node.name !== "FencedCode") return;
      if (!showsRendering(update.state, node.node)) return;
      const [from, to] = lineRange(update.state, node.node);
      if (!touches(now, from, to) || touches(before, from, to)) return;
      const first = update.state.doc.lineAt(from).number + 1;
      const last = update.state.doc.lineAt(to).number;
      for (let number = first; number <= last; number++) {
        lines.add(update.state.doc.line(number).from);
      }
    },
  });
  return lines;
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
        detailsAnimationChanged(update.state, update.startState) ||
        syntaxTree(update.state) !== syntaxTree(update.startState)
      ) {
        this.decorations = buildDecorations(
          update.view,
          new Set([...growingLines(update), ...openingLines(update)]),
        );
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    eventHandlers: {
      // Ctrl/Cmd+click follows a link; a plain click places the cursor to edit it. A rendered
      // footnote label follows on a plain click too, since its brackets hide the source to edit.
      mousedown(event, view) {
        const nativeLink =
          event.target instanceof Element ? event.target.closest("[data-html-href]") : null;
        if (nativeLink) {
          if (event.button !== 0 || !(event.ctrlKey || event.metaKey)) return false;
          event.preventDefault();
          followLink(view, nativeLink.getAttribute("data-html-href") ?? "");
          return true;
        }
        const htmlLink =
          event.target instanceof Element ? event.target.closest(".md-html-block a") : null;
        if (htmlLink) {
          if (event.button !== 0 || !(event.ctrlKey || event.metaKey)) return false;
          event.preventDefault();
          followLink(view, htmlLink.getAttribute("href") ?? "");
          return true;
        }
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
      // A plain click on a link written as HTML must not navigate the window away from the document
      click(event) {
        if (event.target instanceof Element && event.target.closest(".md-html-block a") !== null) {
          event.preventDefault();
          return true;
        }
        return false;
      },
      // A right-click on a picture offers what can be done with the file behind it
      contextmenu(event, view) {
        return openImageMenu(view, event);
      },
    },
  },
);

export const livePreview: Extension = [printing, livePreviewPlugin];
