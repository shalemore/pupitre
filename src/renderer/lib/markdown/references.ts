import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";

/**
 * The definitions a document writes for its reference links and pictures, and the label that a
 * reference carries. The Markdown parser keeps a destination in the `LinkReference` block of its
 * definition, not in the `Link` or `Image` node that uses it, so the model resolves them here,
 * under the CommonMark rules: labels match case-insensitively, whitespace inside a label counts as
 * one space, and the first definition of a label wins.
 */

export interface LinkDefinition {
  href: string;
  title: string;
}

/** A label as CommonMark compares it: trimmed, its inner whitespace collapsed, case-folded. */
function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

/** A destination written between angle brackets drops them; any other keeps what it says. */
function destination(source: string): string {
  return source.startsWith("<") && source.endsWith(">") ? source.slice(1, -1) : source;
}

/** The title of a definition, whose node keeps the quotes it was written with. */
function titleText(source: string): string {
  const quote = source[0];
  return (quote === '"' || quote === "'") && source.endsWith(quote) ? source.slice(1, -1) : source;
}

function definitionOf(state: EditorState, node: SyntaxNode): [string, LinkDefinition] | undefined {
  const label = node.getChild("LinkLabel");
  const url = node.getChild("URL");
  if (label === null || url === null) return undefined;
  const key = normalizeLabel(state.sliceDoc(label.from + 1, label.to - 1));
  if (key === "") return undefined;
  const title = node.getChild("LinkTitle");
  return [
    key,
    {
      href: destination(state.sliceDoc(url.from, url.to)),
      title: title === null ? "" : titleText(state.sliceDoc(title.from, title.to)),
    },
  ];
}

const cache = new WeakMap<EditorState, ReadonlyMap<string, LinkDefinition>>();

/** The definitions of the document, read once for each state and shared by every caller. */
function linkDefinitions(state: EditorState): ReadonlyMap<string, LinkDefinition> {
  const cached = cache.get(state);
  if (cached !== undefined) return cached;
  const definitions = new Map<string, LinkDefinition>();
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "LinkReference") return;
      const definition = definitionOf(state, node.node);
      if (definition !== undefined && !definitions.has(definition[0])) {
        definitions.set(definition[0], definition[1]);
      }
      return false;
    },
  });
  cache.set(state, definitions);
  return definitions;
}

/**
 * The label a `Link` or `Image` node refers to. A full reference writes it in a second bracket
 * pair, a collapsed or shortcut reference uses the text it wraps.
 */
function referenceLabel(
  state: EditorState,
  node: SyntaxNode,
  contentFrom: number,
  contentTo: number,
): string {
  const label = node.getChild("LinkLabel");
  if (label !== null) {
    const written = state.sliceDoc(label.from + 1, label.to - 1);
    if (written.trim() !== "") return written;
  }
  return state.sliceDoc(contentFrom, contentTo);
}

/** The definition a reference node points at, or undefined when the document defines no such label. */
export function referenceTarget(
  state: EditorState,
  node: SyntaxNode,
  contentFrom: number,
  contentTo: number,
): LinkDefinition | undefined {
  const label = referenceLabel(state, node, contentFrom, contentTo);
  return linkDefinitions(state).get(normalizeLabel(label));
}
