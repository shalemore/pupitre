import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Extension, type Range, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, type WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { detailsSection, SummaryWidget, toggledDetails, toggleDetails } from "./details";
import { HtmlBlockWidget, isRenderableHtml } from "./html";
import { documentBaseUrl } from "./images";
import { printingChanged, revealingRanges, touches } from "./live-preview";
import { MATH_LANGUAGE, MathWidget } from "./math";
import { diagramTheme, MermaidWidget } from "./mermaid";
import { TableWidget, tableModel } from "./table";

/**
 * Blocks that are shown rendered (tables, display math, diagrams, HTML, `<details>`), with the same rule as the live preview:
 * away from the selection the block is replaced by its rendering; once a selection touches it, its
 * source is shown with the rendering under it. Replacing whole lines needs block decorations,
 * which CodeMirror only takes from a state field.
 */

/** Containers whose children can be rendered blocks; other blocks are never entered. */
const CONTAINER = /^(?:Document|Blockquote|BulletList|OrderedList|ListItem)$/;

function blockWidget(state: EditorState, node: SyntaxNode): WidgetType | undefined {
  const text = (child: SyntaxNode | null | undefined) =>
    child ? state.sliceDoc(child.from, child.to) : "";
  if (node.name === "Table") {
    return new TableWidget(state.sliceDoc(node.from, node.to), tableModel(state, node));
  }
  if (node.name === "HTMLBlock") {
    const source = text(node);
    return isRenderableHtml(source)
      ? new HtmlBlockWidget(source, state.facet(documentBaseUrl))
      : undefined;
  }
  if (node.name === "BlockMath") {
    const [open, close] = node.getChildren("MathMark");
    return new MathWidget(state.sliceDoc(open?.to ?? node.from, close?.from ?? node.to), true);
  }
  if (node.name !== "FencedCode") return undefined;
  const language = text(node.getChild("CodeInfo")).trim();
  const code = text(node.getChild("CodeText"));
  if (MATH_LANGUAGE.test(language)) return new MathWidget(code, true);
  if (language.toLowerCase() === "mermaid")
    return new MermaidWidget(code, state.facet(diagramTheme));
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
      if (!touches(ranges, node.from, node.to)) hideLines(node.from, node.to, widget);
      // A table's source reads as a table already; other blocks show their rendering under it
      else if (node.name !== "Table") {
        const end = doc.lineAt(node.to).to;
        decorations.push(Decoration.widget({ widget, block: true, side: 1 }).range(end));
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

export const renderedBlocks: Extension = [toggledDetails, renderedBlockDecorations];
