import { syntaxTree } from "@codemirror/language";
import {
  type EditorState,
  type Extension,
  type Range,
  StateField,
  type Transaction,
} from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, type WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { fencedText } from "./block-text";
import {
  detailsAnimation,
  detailsSection,
  SummaryWidget,
  toggledDetails,
  toggleDetails,
} from "./details";
import { collectHeadings } from "./document-structure";
import { HtmlBlockWidget, isRenderableHtml } from "./html";
import { htmlBlockPreview } from "./html-block";
import { documentBaseUrl, parseImageTag } from "./images";
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
const RENDERED_NODE = /^(?:Table|HTMLBlock|BlockMath|FencedCode)$/;
const MAX_TOC_LENGTH = 64;

function isTocParagraph(state: EditorState, node: SyntaxNode): boolean {
  return (
    node.name === "Paragraph" &&
    node.to - node.from <= MAX_TOC_LENGTH &&
    TOC_MARKER.test(state.sliceDoc(node.from, node.to))
  );
}

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

function blockWidget(
  state: EditorState,
  node: SyntaxNode,
  editing = false,
): WidgetType | undefined {
  const text = (child: SyntaxNode | null | undefined) =>
    child ? state.sliceDoc(child.from, child.to) : "";
  if (node.name === "Table") {
    return new TableWidget(state.sliceDoc(node.from, node.to), readTable(state, node));
  }
  if (node.name === "Paragraph") {
    return isTocParagraph(state, node) ? new TocWidget(collectHeadings(state)) : undefined;
  }
  if (node.name === "HTMLBlock") {
    const source = text(node);
    if (!isRenderableHtml(source) || htmlBlockPreview(source) !== undefined) return undefined;
    return new HtmlBlockWidget(source, state.facet(documentBaseUrl), editing);
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

interface SensitiveRange {
  from: number;
  to: number;
  touched: boolean;
}

interface RenderedBlocksState {
  decorations: DecorationSet;
  sensitive: readonly SensitiveRange[];
  hasToc: boolean;
}

function buildDecorations(state: EditorState): RenderedBlocksState {
  const decorations: Range<Decoration>[] = [];
  const sensitive: SensitiveRange[] = [];
  let hasToc = false;
  const { doc } = state;
  const ranges = revealingRanges(state);
  const isTouched = (from: number, to: number): boolean => {
    const touched = touches(ranges, from, to);
    sensitive.push({ from, to, touched });
    return touched;
  };
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
        if (!isTouched(node.from, node.to)) {
          hideLines(node.from, node.to, new SummaryWidget(summary, open, node.from));
        }
        const contentFrom = doc.lineAt(node.to).to + 1;
        const contentTo = closing ? doc.lineAt(closing.from).from - 1 : doc.length;
        // A closed section opens while the selection is inside it, such as a search match
        if (!open && contentTo > contentFrom && !isTouched(contentFrom, contentTo)) {
          hideLines(contentFrom, contentTo);
          hiddenUntil = contentTo;
        }
        if (closing && !isTouched(closing.from, closing.to)) {
          hideLines(closing.from, closing.to);
        }
        return false;
      }
      // The block takes whole lines, the markers of a quote or a list around it included, so a
      // cursor anywhere on them reveals its source; a click on the rendering puts it on the first
      const [from, to] = lineRange(state, node.node);
      const touched = isTouched(from, to);
      const widget = blockWidget(state, node.node, touched);
      if (!widget) return false;
      if (widget instanceof TocWidget) hasToc = true;
      // A table is edited in place (table.tsx), so its source never shows
      if (node.name === "Table" || !touched) {
        hideLines(node.from, node.to, widget);
      } else if (
        node.name === "BlockMath" ||
        node.name === "FencedCode" ||
        // An `<img>` tag reads like a Markdown image: the picture above, its source below
        (node.name === "HTMLBlock" &&
          parseImageTag(state.sliceDoc(node.from, node.to)) !== undefined)
      ) {
        // Math and diagrams open in the first line of their source, which is a code card, so the
        // rendering and the source stay one piece instead of becoming two blocks of their own
        decorations.push(Decoration.widget({ widget, side: 1 }).range(from));
      } else {
        decorations.push(Decoration.widget({ widget, block: true, side: 1 }).range(to));
      }
      return false;
    },
  });
  return { decorations: Decoration.set(decorations, true), sensitive, hasToc };
}

function hasRenderedBlockOrSpill(state: EditorState, from: number, to: number): boolean {
  let found = false;
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      if (CONTAINER.test(node.name)) return true;
      if (RENDERED_NODE.test(node.name) || isTocParagraph(state, node.node) || node.to > to) {
        found = true;
      }
      return false;
    },
  });
  return found;
}

function mapDecorations(
  current: RenderedBlocksState,
  tr: Transaction,
): RenderedBlocksState | undefined {
  if (current.hasToc) return undefined;
  let ranges = 0;
  let canMap = true;
  tr.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
    if (!canMap || ++ranges > 8) {
      canMap = false;
      return;
    }
    const firstLineA = tr.startState.doc.lineAt(fromA);
    const checkFromA =
      firstLineA.number > 1 ? tr.startState.doc.line(firstLineA.number - 1).from : firstLineA.from;
    const checkToA = tr.startState.doc.lineAt(toA).to;
    current.decorations.between(checkFromA, checkToA, () => {
      canMap = false;
      return false;
    });
    if (!canMap || current.sensitive.some(({ from, to }) => from <= checkToA && to >= checkFromA)) {
      canMap = false;
      return;
    }
    const firstLineB = tr.state.doc.lineAt(fromB);
    const checkFromB =
      firstLineB.number > 1 ? tr.state.doc.line(firstLineB.number - 1).from : firstLineB.from;
    const checkToB = tr.state.doc.lineAt(toB).to;
    if (
      hasRenderedBlockOrSpill(tr.startState, checkFromA, checkToA) ||
      hasRenderedBlockOrSpill(tr.state, checkFromB, checkToB)
    ) {
      canMap = false;
    }
  });
  if (!canMap) return undefined;
  const decorations = current.decorations.map(tr.changes);
  if (current.sensitive.length === 0) {
    return decorations === current.decorations
      ? current
      : { decorations, sensitive: current.sensitive, hasToc: false };
  }
  const rangesAfter = revealingRanges(tr.state);
  const sensitive: SensitiveRange[] = [];
  for (const range of current.sensitive) {
    const from = tr.changes.mapPos(range.from, 1);
    const to = tr.changes.mapPos(range.to, -1);
    if (touches(rangesAfter, from, to) !== range.touched) return undefined;
    sensitive.push({ from, to, touched: range.touched });
  }
  return { decorations, sensitive, hasToc: false };
}

const renderedBlockDecorations = StateField.define<RenderedBlocksState>({
  create: buildDecorations,
  update: (current, tr) => {
    if (
      tr.effects.some((effect) => effect.is(toggleDetails)) ||
      printingChanged(tr.state, tr.startState) ||
      tr.state.facet(diagramTheme) !== tr.startState.facet(diagramTheme)
    ) {
      return buildDecorations(tr.state);
    }
    if (tr.docChanged) {
      return mapDecorations(current, tr) ?? buildDecorations(tr.state);
    }
    if (syntaxTree(tr.state) !== syntaxTree(tr.startState)) {
      return buildDecorations(tr.state);
    }
    if (!tr.selection) return current;
    const ranges = revealingRanges(tr.state);
    const changed = current.sensitive.some(
      ({ from, to, touched }) => touches(ranges, from, to) !== touched,
    );
    return changed ? buildDecorations(tr.state) : current;
  },
  provide: (field) => EditorView.decorations.from(field, (state) => state.decorations),
});

export const renderedBlocks: Extension = [
  toggledDetails,
  detailsAnimation,
  renderedBlockDecorations,
  tableCursor,
];
