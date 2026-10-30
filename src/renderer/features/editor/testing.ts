import { ensureSyntaxTree } from "@codemirror/language";
import {
  EditorSelection,
  EditorState,
  type Extension,
  type TransactionSpec,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SyntaxNode, Tree } from "@lezer/common";
import { markdownLanguage } from "./markdown-language";

/**
 * Helpers for the editor's unit tests. A document is written with `|` marking the cursor, or two of
 * them around the selection, so a test reads the way the text looks in the editor.
 */

/** Parses the whole document; the editor itself stops after a time budget and goes on later. */
export function fullTree(state: EditorState): Tree {
  const tree = ensureSyntaxTree(state, state.doc.length, 60_000);
  if (!tree) throw new Error("The document could not be parsed in time");
  return tree;
}

/**
 * The state whose syntax tree is the one `fullTree` reached. Parsing happens in the language
 * field's mutable context until a transaction copies its tree into the state; reading `syntaxTree`
 * before that can hand back the tree the state was created with, which stops early under a slow run.
 */
function withParsedTree(state: EditorState): EditorState {
  fullTree(state);
  return state.update({}).state;
}

export function markdownState(doc: string): EditorState {
  return withParsedTree(EditorState.create({ doc, extensions: markdownLanguage }));
}

/** The state after `spec`, parsed again from what changed, as the editor does while typing. */
export function updated(state: EditorState, spec: TransactionSpec): EditorState {
  return withParsedTree(state.update(spec).state);
}

/** Every node of the tree with its position, which two trees of the same text must agree on. */
export function treeShape(state: EditorState): string[] {
  const shape: string[] = [];
  fullTree(state).iterate({
    enter: (node) => void shape.push(`${node.name} ${node.from}-${node.to}`),
  });
  return shape;
}

export function firstNode(state: EditorState, name: string): SyntaxNode {
  let found: SyntaxNode | undefined;
  fullTree(state).iterate({
    enter: (node) => {
      if (found) return false;
      if (node.name === name) found = node.node;
      return undefined;
    },
  });
  if (!found) throw new Error(`The document has no ${name}`);
  return found;
}

/** A view of `text`, where `|` stands for the cursor or the two ends of the selection. */
export function markdownView(text: string, extra: readonly Extension[] = []): EditorView {
  const [before = "", selected, after] = text.split("|");
  const doc = after === undefined ? before + (selected ?? "") : before + selected + after;
  const anchor = before.length;
  const head = after === undefined ? anchor : anchor + (selected ?? "").length;
  const view = new EditorView({
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(anchor, head),
      extensions: [markdownLanguage, ...extra],
    }),
  });
  fullTree(view.state);
  // The view's state only receives the tree the parse reached on its next transaction
  view.dispatch({});
  return view;
}

/** The document of a view with its selection marked the way markdownView reads it. */
export function marked(view: EditorView): string {
  const { from, to, empty } = view.state.selection.main;
  const doc = view.state.doc.toString();
  if (empty) return `${doc.slice(0, from)}|${doc.slice(from)}`;
  return `${doc.slice(0, from)}|${doc.slice(from, to)}|${doc.slice(to)}`;
}
