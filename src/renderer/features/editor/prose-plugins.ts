import type { Node } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";

export interface OutlineHeading {
  level: number;
  text: string;
  /** Position of the heading node, used to scroll to it. */
  pos: number;
}

export function collectHeadings(doc: Node): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return true;
    const level: unknown = node.attrs["level"];
    headings.push({ level: typeof level === "number" ? level : 1, text: node.textContent, pos });
    return false;
  });
  return headings;
}

/** The section the cursor is in: the last heading at or before the cursor. */
export function findActiveHeading(headings: readonly OutlineHeading[], cursor: number): number {
  return headings.findLastIndex((heading) => heading.pos <= cursor);
}

export interface DocumentObserver {
  onDocChange: (doc: Node) => void;
  onSelectionChange: (cursor: number) => void;
}

/** Reports document and selection changes (outline, word count, current section), only when they change. */
export function documentObserverPlugin(observer: DocumentObserver): Plugin {
  return new Plugin({
    view(initialView) {
      observer.onDocChange(initialView.state.doc);
      observer.onSelectionChange(initialView.state.selection.from);
      return {
        update({ state }, prevState) {
          if (!state.doc.eq(prevState.doc)) observer.onDocChange(state.doc);
          if (!state.selection.eq(prevState.selection))
            observer.onSelectionChange(state.selection.from);
        },
      };
    },
  });
}

const textDirectionKey = new PluginKey<DecorationSet>("text-direction");

function directionDecorations(doc: Node): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    // Code blocks are always left to right; CodeMirror handles them itself
    if (node.type.name === "code_block") return false;
    if (node.isTextblock || node.type.name === "list_item") {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { dir: "auto" }));
    }
    return !node.isTextblock;
  });
  return DecorationSet.create(doc, decorations);
}

/**
 * Adds `dir="auto"` to every paragraph, heading and list item so the browser decides the direction from the first strong character of its content,
 * which aligns each paragraph correctly when Arabic, Hebrew and Latin text are mixed.
 */
export const textDirectionPlugin = new Plugin<DecorationSet>({
  key: textDirectionKey,
  state: {
    init: (_config, state) => directionDecorations(state.doc),
    apply: (tr, previous) => (tr.docChanged ? directionDecorations(tr.doc) : previous),
  },
  props: {
    decorations: (state) => textDirectionKey.getState(state),
  },
});
