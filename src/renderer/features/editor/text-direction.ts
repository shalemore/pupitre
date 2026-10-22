import type { Node } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { direction } from "direction";

/**
 * Bidirectional text, handled in one place.
 *
 * Every block gets the base direction of its first strong character, the rule the Unicode
 * Bidirectional Algorithm (and HTML's dir="auto") uses for paragraphs. That keeps an Arabic
 * paragraph right-aligned in an English document and a Chinese paragraph left-aligned in an
 * Arabic interface. dir="auto" itself cannot be used: it ignores descendants that carry their own
 * dir, so a list or quote would never see the text of its paragraphs. Blocks without strong
 * characters (empty lines, numbers) inherit their parent's direction, and the document root takes
 * the direction of the whole document so empty lines line up with the text around them.
 *
 * Code blocks are always left-to-right; inline code, math and diagrams are isolated in CSS
 * (features/editor/editor.css) so they never reorder the sentence around them.
 */

/** Containers whose layout (list markers, quote bar, column order) follows their direction. */
const CONTAINERS = new Set(["blockquote", "bullet_list", "ordered_list", "list_item", "table"]);

const textDirectionKey = new PluginKey<DecorationSet>("text-direction");

function textDirection(node: Node): "ltr" | "rtl" | undefined {
  const detected = direction(node.textContent);
  return detected === "neutral" ? undefined : detected;
}

function directionDecorations(doc: Node): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "code_block") {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { dir: "ltr" }));
      return false;
    }
    if (node.isTextblock || CONTAINERS.has(node.type.name)) {
      const dir = textDirection(node);
      if (dir) decorations.push(Decoration.node(pos, pos + node.nodeSize, { dir }));
    }
    return !node.isTextblock;
  });
  return DecorationSet.create(doc, decorations);
}

export const textDirectionPlugin = new Plugin<DecorationSet>({
  key: textDirectionKey,
  state: {
    init: (_config, state) => directionDecorations(state.doc),
    apply: (tr, previous) => (tr.docChanged ? directionDecorations(tr.doc) : previous),
  },
  props: {
    decorations: (state) => textDirectionKey.getState(state),
    attributes: (state): Record<string, string> => {
      const dir = textDirection(state.doc);
      return dir ? { dir } : {};
    },
  },
});
