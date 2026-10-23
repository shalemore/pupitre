import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Range, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, type WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { touches } from "./live-preview";
import { MATH_LANGUAGE, MathWidget } from "./math";

/**
 * Blocks that are shown rendered (display math), with the same rule as the live preview:
 * away from the selection the block is replaced by its rendering; once a selection touches it, its
 * source is shown with the rendering under it. Replacing whole lines needs block decorations,
 * which CodeMirror only takes from a state field.
 */

/** Containers whose children can be rendered blocks; other blocks are never entered. */
const CONTAINER = /^(?:Document|Blockquote|BulletList|OrderedList|ListItem)$/;

function blockWidget(state: EditorState, node: SyntaxNode): WidgetType | undefined {
  const text = (child: SyntaxNode | null | undefined) =>
    child ? state.sliceDoc(child.from, child.to) : "";
  if (node.name === "BlockMath") {
    const [open, close] = node.getChildren("MathMark");
    return new MathWidget(state.sliceDoc(open?.to ?? node.from, close?.from ?? node.to), true);
  }
  if (node.name !== "FencedCode") return undefined;
  const language = text(node.getChild("CodeInfo")).trim();
  const code = text(node.getChild("CodeText"));
  if (MATH_LANGUAGE.test(language)) return new MathWidget(code, true);
  return undefined;
}

function buildDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (CONTAINER.test(node.name)) return true;
      const widget = blockWidget(state, node.node);
      if (!widget) return false;
      // Block decorations cover whole lines, including the indentation of a nested block
      const from = state.doc.lineAt(node.from).from;
      const to = state.doc.lineAt(node.to).to;
      if (touches(state.selection, node.from, node.to)) {
        decorations.push(Decoration.widget({ widget, block: true, side: 1 }).range(to));
      } else {
        decorations.push(Decoration.replace({ widget, block: true }).range(from, to));
      }
      return false;
    },
  });
  return Decoration.set(decorations);
}

export const renderedBlocks = StateField.define<DecorationSet>({
  create: buildDecorations,
  update: (decorations, tr) =>
    tr.docChanged || tr.selection || syntaxTree(tr.state) !== syntaxTree(tr.startState)
      ? buildDecorations(tr.state)
      : decorations,
  provide: (field) => EditorView.decorations.from(field),
});
