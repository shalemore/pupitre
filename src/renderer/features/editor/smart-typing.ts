import { closeBrackets } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import {
  ChangeSet,
  EditorState,
  type Extension,
  StateEffect,
  Transaction,
  type TransactionSpec,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

/** The two settings that rewrite a character while it is typed. */
export interface SmartTyping {
  smartQuotes: boolean;
  smartDashes: boolean;
}

/**
 * Nodes whose text is read as written. Code, math, front matter, raw HTML and the destination or
 * title of a link all keep the characters a file needs, so a quote or a dash typed there is not
 * turned into typography.
 */
const LITERAL_TEXT = new Set([
  "InlineCode",
  "CodeText",
  "CodeBlock",
  "FencedCode",
  "CodeMark",
  "InlineMath",
  "BlockMath",
  "MathMark",
  "FrontMatter",
  "FrontMatterMark",
  "HTMLBlock",
  "HTMLTag",
  "CommentBlock",
  "Comment",
  "ProcessingInstructionBlock",
  "ProcessingInstruction",
  "URL",
  "LinkTitle",
]);

function isLiteralText(state: EditorState, pos: number): boolean {
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1);
    node;
    node = node.parent
  ) {
    if (LITERAL_TEXT.has(node.name)) return true;
  }
  return false;
}

const CURLY_QUOTES: Readonly<Record<string, { open: string; close: string }>> = {
  '"': { open: "“", close: "”" },
  "'": { open: "‘", close: "’" },
};

/** What an opening quote can follow: the start of the text, a space, an opening bracket or a dash. */
const OPENING_BEFORE = /[\s([{<«“‘‚‛¿¡—–]/;

/**
 * The typographic form of a typed quote: opening where a word starts, closing where one ends, so
 * `'` after a letter becomes the apostrophe it is.
 */
function curlyQuote(state: EditorState, at: number, typed: string): string | undefined {
  const quotes = CURLY_QUOTES[typed];
  if (quotes === undefined) return undefined;
  const before = at === 0 ? "" : state.sliceDoc(at - 1, at);
  return before === "" || OPENING_BEFORE.test(before) ? quotes.open : quotes.close;
}

/**
 * What runs of punctuation become: `--` and `---` an en and an em dash, `...` an ellipsis. A
 * longer run, or a run that starts its line, is Markdown syntax — a rule, a list marker, a fence —
 * rather than punctuation.
 */
const PUNCTUATION: readonly { char: string; runs: Readonly<Record<number, string>> }[] = [
  { char: "-", runs: { 2: "–", 3: "—" } },
  { char: ".", runs: { 3: "…" } },
];

/** The start of the run of `char` that ends at `at`. */
function runStart(state: EditorState, at: number, char: string): number {
  let start = at;
  while (start > 0 && state.sliceDoc(start - 1, start) === char) start--;
  return start;
}

/** The token that ends at `at` and the character it stands for, if it is one that gets replaced. */
function punctuationToken(
  state: EditorState,
  at: number,
): { from: number; insert: string } | undefined {
  const char = at === 0 ? "" : state.sliceDoc(at - 1, at);
  const punctuation = PUNCTUATION.find((candidate) => candidate.char === char);
  if (punctuation === undefined) return undefined;
  const from = runStart(state, at, char);
  const insert = punctuation.runs[at - from];
  // A token in the middle of a longer run belongs to it
  if (insert === undefined || state.sliceDoc(at, at + 1) === char) return undefined;
  const line = state.doc.lineAt(from);
  if (/^[ \t]*$/.test(state.sliceDoc(line.from, from))) return undefined;
  return { from, insert };
}

/** The user event of text that was typed, as opposed to a paste, a drop or a composition, which bring their own characters. */
function typingEvent(tr: Transaction): string | undefined {
  const event = tr.annotation(Transaction.userEvent);
  return event === "input" || event === "input.type" ? event : undefined;
}

/** Where a transaction typed whitespace, when it typed into the empty selection of one caret. */
function typedWhitespace(tr: Transaction): { at: number; text: string } | undefined {
  const { main, ranges } = tr.startState.selection;
  if (!main.empty || ranges.length > 1) return undefined;
  const typed: { at: number; text: string }[] = [];
  tr.changes.iterChanges((fromA, _toA, _fromB, _toB, inserted) => {
    typed.push({ at: fromA, text: inserted.toString() });
  });
  const [change] = typed;
  if (typed.length !== 1 || change === undefined || !/^\s/.test(change.text)) return undefined;
  return change;
}

/**
 * The same transaction with a token before what it typed replaced as well. Both edits are one
 * change, so one Undo takes back the character and the punctuation it turned a token into. The
 * change sets of the two edits are composed rather than added to the transaction in turn, which
 * keeps the caret and the effects where the transaction put them.
 */
function withTokenReplaced(
  tr: Transaction,
  token: { from: number; to: number; insert: string },
  userEvent: string,
): TransactionSpec {
  const replacement = ChangeSet.of(token, tr.startState.doc.length);
  const after = replacement.map(tr.changes, true);
  return {
    changes: replacement.compose(tr.changes.map(replacement)),
    selection: tr.newSelection.map(after),
    effects: StateEffect.mapEffects(tr.effects, after),
    // A transaction keeps its annotations to itself, so the one that says this is typing is named
    // again here; the history groups the change by it
    userEvent,
    scrollIntoView: tr.scrollIntoView,
  };
}

/**
 * The `inputHandler` that types quotes, and the filter that turns a token into punctuation once
 * the space or the line break after it is typed. Both read the settings as they run, so switching
 * one on or off needs no reconfiguration of the editor.
 */
export function smartTyping(options: () => SmartTyping): Extension {
  return [
    EditorView.inputHandler.of((view, from, to, text) => {
      // Only a quote typed into an empty caret is rewritten: a selection keeps the character that
      // replaces it, and an input method keeps the characters it brings
      if (!options().smartQuotes || view.compositionStarted) return false;
      if (view.state.selection.ranges.length > 1 || from !== to) return false;
      const quote = curlyQuote(view.state, from, text);
      if (quote === undefined || isLiteralText(view.state, from)) return false;
      view.dispatch({
        changes: { from, to, insert: quote },
        selection: { anchor: from + quote.length },
        userEvent: "input.type",
      });
      return true;
    }),
    EditorState.transactionFilter.of((tr) => {
      const userEvent = typingEvent(tr);
      if (!options().smartDashes || !tr.docChanged || userEvent === undefined) return tr;
      const typed = typedWhitespace(tr);
      if (typed === undefined) return tr;
      const token = punctuationToken(tr.startState, typed.at);
      if (token === undefined || isLiteralText(tr.startState, token.from)) return tr;
      return withTokenReplaced(
        tr,
        { from: token.from, to: typed.at, insert: token.insert },
        userEvent,
      );
    }),
  ];
}

/** The brackets, quotes and backtick CodeMirror pairs; its own defaults leave the backtick out. */
const BRACKETS = ["(", "[", "{", "'", '"', "`"];

/** The Markdown markers of inline syntax, which pair with themselves. */
const MARKDOWN_MARKERS = ["*", "_", "~", "$", "^"];

/**
 * CodeMirror's bracket closing, with the Markdown markers as well while the setting is on. It is
 * one extension so the editor can keep it in a compartment: turning the setting on or off changes
 * what is typed without reloading the document.
 */
export function markdownPairing(markdownMarkers: boolean): Extension {
  const brackets = markdownMarkers ? [...BRACKETS, ...MARKDOWN_MARKERS] : BRACKETS;
  return [closeBrackets(), EditorState.languageData.of(() => [{ closeBrackets: { brackets } }])];
}
