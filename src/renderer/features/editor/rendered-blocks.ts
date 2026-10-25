import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Extension, type Range, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, type WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { fencedText } from "./block-text";
import { detailsSection, SummaryWidget, toggledDetails, toggleDetails } from "./details";
import { collectHeadings } from "./document-structure";
import { HtmlBlockWidget, isRenderableHtml } from "./html";
import { documentBaseUrl } from "./images";
import { printingChanged, revealingRanges, touches, lineRange } from "./live-preview";
import { mathFence, mathOf, MathWidget } from "./math";
import { diagramTheme, MermaidWidget } from "./mermaid";
import { TableWidget, tableCursor } from "./table";
import { readTable } from "./table-model";
import { TOC_MARKER, TocWidget } from "./toc";

/**
 * Blocks that are shown rendered (tables, display math, diagrams, HTML, `<details>`, `[TOC]`), with the same rule as the live preview:
 * away from the selection the block is replaced by its rendering; once a selection touches it, its
 * source is shown with the rendering under it. Replacing whole lines needs block decorations,
 * which CodeMirror only takes from a state field.
 */

/** Containers whose children can be rendered blocks; other blocks are never entered. */
const CONTAINER = /^(?:Document|Blockquote|BulletList|OrderedList|ListItem)$/;

/**
 * The end of the source of a rendered block, which is where a click on its rendering puts the
 * cursor: the last line of a fence, the last character of a formula.
 */
function sourceEnd(state: EditorState, node: SyntaxNode): number {
  const marks = node.getChildren(node.name === "BlockMath" ? "MathMark" : "CodeMark");
  const close = marks.length > 1 ? marks.at(-1) : undefined;
  if (!close) return node.to;
  // A closing fence or `$$` takes a line of its own, so the source ends on the line before it
  const line = state.doc.lineAt(close.from);
  return line.from > node.from ? line.from - 1 : close.from;
}

function blockWidget(state: EditorState, node: SyntaxNode): WidgetType | undefined {
  const text = (child: SyntaxNode | null | undefined) =>
    child ? state.sliceDoc(child.from, child.to) : "";
  if (node.name === "Table") {
    return new TableWidget(state.sliceDoc(node.from, node.to), readTable(state, node));
  }
  if (node.name === "Paragraph") {
    return TOC_MARKER.test(text(node)) ? new TocWidget(collectHeadings(state)) : undefined;
  }
  if (node.name === "HTMLBlock") {
    const source = text(node);
    return isRenderableHtml(source)
      ? new HtmlBlockWidget(source, state.facet(documentBaseUrl))
      : undefined;
  }
  if (node.name === "BlockMath") {
    return new MathWidget(mathOf(state, node).tex, true, sourceEnd(state, node));
  }
  if (node.name !== "FencedCode") return undefined;
  const formula = mathFence(state, node);
  if (formula !== undefined) return new MathWidget(formula, true, sourceEnd(state, node));
  const language = text(node.getChild("CodeInfo")).trim();
  const code = fencedText(state, node);
  if (language.toLowerCase() === "mermaid") {
    return new MermaidWidget(code, state.facet(diagramTheme), sourceEnd(state, node));
  }
  return undefined;
}

function buildDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const { doc } = state;
  const ranges = revealingRanges(state);
  // Block decorations cover whole lines, including the indentation of a nested block
  const hideLines = (from: number, to: number, widget?: WidgetType) =>
    decorations.push(
      Decoration.replace({ ...(widget && { widget }), block: true }).range(
        doc.lineAt(from).from,
        doc.lineAt(to).to,
      ),
    );
  // The end of a collapsed section; blocks inside it are not rendered
  let hiddenUntil = -1;

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.from <= hiddenUntil) return false;
      if (CONTAINER.test(node.name)) return true;
      const details = node.name === "HTMLBlock" ? detailsSection(state, node.node) : undefined;
      if (details) {
        const { summary, open, closing } = details;
        if (!touches(ranges, node.from, node.to)) {
          hideLines(node.from, node.to, new SummaryWidget(summary, open, node.from));
        }
        const contentFrom = doc.lineAt(node.to).to + 1;
        const contentTo = closing ? doc.lineAt(closing.from).from - 1 : doc.length;
        // A closed section opens while the selection is inside it, such as a search match
        if (!open && contentTo > contentFrom && !touches(ranges, contentFrom, contentTo)) {
          hideLines(contentFrom, contentTo);
          hiddenUntil = contentTo;
        }
        if (closing && !touches(ranges, closing.from, closing.to)) {
          hideLines(closing.from, closing.to);
        }
        return false;
      }
      const widget = blockWidget(state, node.node);
      if (!widget) return false;
      // The block takes whole lines, the markers of a quote or a list around it included, so a
      // cursor anywhere on them reveals its source; a click on the rendering puts it on the first
      const [from, to] = lineRange(state, node.node);
      // A table is edited in place (table.tsx), so its source never shows
      if (node.name === "Table" || !touches(ranges, from, to)) {
        hideLines(node.from, node.to, widget);
      } else if (node.name === "BlockMath" || node.name === "FencedCode") {
        // Math and diagrams open in the first line of their source, which is a code card, so the
        // rendering and the source stay one piece instead of becoming two blocks of their own
        decorations.push(Decoration.widget({ widget, side: 1 }).range(from));
      } else {
        decorations.push(Decoration.widget({ widget, block: true, side: 1 }).range(to));
      }
      return false;
    },
  });
  return Decoration.set(decorations, true);
}

const renderedBlockDecorations = StateField.define<DecorationSet>({
  create: buildDecorations,
  update: (decorations, tr) =>
    tr.docChanged ||
    tr.selection ||
    tr.effects.some((effect) => effect.is(toggleDetails)) ||
    printingChanged(tr.state, tr.startState) ||
    tr.state.facet(diagramTheme) !== tr.startState.facet(diagramTheme) ||
    syntaxTree(tr.state) !== syntaxTree(tr.startState)
      ? buildDecorations(tr.state)
      : decorations,
  provide: (field) => EditorView.decorations.from(field),
});

export const renderedBlocks: Extension = [toggledDetails, renderedBlockDecorations, tableCursor];
