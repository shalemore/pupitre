import { syntaxTree } from "@codemirror/language";
import {
  type ChangeSpec,
  EditorSelection,
  type EditorState,
  type Line,
  type SelectionRange,
} from "@codemirror/state";
import type { EditorView, KeyBinding } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { FORMAT_ACTIONS, type FormatAction } from "@shared/format";
import type { Settings } from "@shared/settings";

/**
 * Formatting as text edits: every action inserts or removes Markdown syntax in the source, the
 * same characters the user could type, so the result is exactly what is written to the file.
 * Inserted syntax follows the user's Markdown style settings.
 */

export type MarkdownStyle = Pick<
  Settings,
  | "bulletMarker"
  | "emphasisMarker"
  | "strongMarker"
  | "fenceMarker"
  | "ruleMarker"
  | "incrementListMarker"
>;

/** Quote and list markers in front of a line's content. */
const CONTAINER_PREFIX = /^(?:[ \t]*(?:>|[-*+](?=[ \t])|\d{1,9}[.)](?=[ \t])))*[ \t]*/;
const HEADING_PREFIX = /^(#{1,6})(?:[ \t]+|$)/;
const QUOTE_PREFIX = /^([ \t]*)> ?/;
const LIST_PREFIX = /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/;

function dispatchChanges(view: EditorView, changes: ChangeSpec, selection?: EditorSelection): void {
  view.dispatch(
    view.state.update({
      changes,
      ...(selection && { selection }),
      scrollIntoView: true,
      userEvent: "input.format",
    }),
  );
}

/** The innermost `name` node that contains the whole range. */
function enclosing(
  state: EditorState,
  range: SelectionRange,
  name: string,
): SyntaxNode | undefined {
  const sides: (1 | -1)[] = range.empty ? [1, -1] : [1];
  for (const side of sides) {
    for (
      let node: SyntaxNode | null = syntaxTree(state).resolveInner(range.from, side);
      node;
      node = node.parent
    ) {
      if (node.name === name && node.from <= range.from && node.to >= range.to) return node;
    }
  }
  return undefined;
}

/** Wraps each selection in `marker`, or removes the format when the selection is already inside it. */
function toggleInline(view: EditorView, name: string, marker: string): void {
  const { state } = view;
  view.dispatch(
    state.update(
      state.changeByRange((range) => {
        const node = enclosing(state, range, name);
        const open = node?.firstChild;
        const close = node?.lastChild;
        if (open && close && open.from !== close.from) {
          const changes = state.changes([
            { from: open.from, to: open.to },
            { from: close.from, to: close.to },
          ]);
          return { changes, range: range.map(changes) };
        }
        const size = marker.length;
        return {
          changes: [
            { from: range.from, insert: marker },
            { from: range.to, insert: marker },
          ],
          range: EditorSelection.range(range.anchor + size, range.head + size),
        };
      }),
      { scrollIntoView: true, userEvent: "input.format" },
    ),
  );
}

/** Turns the selection into link text and puts the cursor where the address goes; inside a link, selects its address. */
function toggleLink(view: EditorView): void {
  const { state } = view;
  view.dispatch(
    state.update(
      state.changeByRange((range) => {
        const url = enclosing(state, range, "Link")?.getChild("URL");
        if (url) return { range: EditorSelection.range(url.from, url.to) };
        return {
          changes: [
            { from: range.from, insert: "[" },
            { from: range.to, insert: "]()" },
          ],
          range: EditorSelection.cursor(range.empty ? range.from + 1 : range.to + 3),
        };
      }),
      { scrollIntoView: true, userEvent: "input.format" },
    ),
  );
}

function selectedLines(state: EditorState): Line[] {
  const lines = new Map<number, Line>();
  for (const range of state.selection.ranges) {
    const last = state.doc.lineAt(range.to).number;
    for (let number = state.doc.lineAt(range.from).number; number <= last; number++) {
      lines.set(number, state.doc.line(number));
    }
  }
  return [...lines.values()];
}

/** Sets the heading level of the selected lines; the level they already have, or 0, makes them paragraphs. */
function setHeading(view: EditorView, level: number): void {
  const changes = selectedLines(view.state).map((line) => {
    const start = line.from + (CONTAINER_PREFIX.exec(line.text)?.[0].length ?? 0);
    const existing = HEADING_PREFIX.exec(line.text.slice(start - line.from));
    const current = existing?.[1]?.length ?? 0;
    const insert = level === 0 || level === current ? "" : `${"#".repeat(level)} `;
    return { from: start, to: start + (existing?.[0].length ?? 0), insert };
  });
  dispatchChanges(view, changes);
}

function toggleQuote(view: EditorView): void {
  const lines = selectedLines(view.state);
  const quoted = lines.every((line) => line.text.trim() === "" || QUOTE_PREFIX.test(line.text));
  const changes = lines.map((line) => {
    if (!quoted) return { from: line.from, insert: "> " };
    const prefix = QUOTE_PREFIX.exec(line.text);
    const indent = prefix?.[1]?.length ?? 0;
    return { from: line.from + indent, to: line.from + (prefix?.[0].length ?? indent) };
  });
  dispatchChanges(view, changes);
}

function toggleList(view: EditorView, ordered: boolean, style: MarkdownStyle): void {
  const lines = selectedLines(view.state);
  const isTarget = (marker: string | undefined) =>
    marker !== undefined && /^\d/.test(marker) === ordered;
  const listed = lines.every((line) => isTarget(LIST_PREFIX.exec(line.text)?.[2]));
  const changes = lines.map((line, index) => {
    const prefix = LIST_PREFIX.exec(line.text);
    const indent = prefix?.[1]?.length ?? /^[ \t]*/.exec(line.text)?.[0].length ?? 0;
    const to = line.from + (prefix?.[0].length ?? indent);
    if (listed) return { from: line.from + indent, to };
    const number = style.incrementListMarker ? index + 1 : 1;
    return {
      from: line.from + indent,
      to,
      insert: ordered ? `${number}. ` : `${style.bulletMarker} `,
    };
  });
  dispatchChanges(view, changes);
}

/** Wraps the selected lines in a fenced block, or opens an empty one with the cursor inside. */
function insertFencedBlock(view: EditorView, fence: string): void {
  const { state } = view;
  const { from, to, empty } = state.selection.main;
  const first = state.doc.lineAt(from);
  const last = state.doc.lineAt(to);
  if (empty && first.text.trim() === "") {
    const insert = `${fence}\n\n${fence}`;
    dispatchChanges(
      view,
      { from: first.from, to: first.to, insert },
      EditorSelection.single(first.from + fence.length + 1),
    );
    return;
  }
  dispatchChanges(view, [
    { from: first.from, insert: `${fence}\n` },
    { from: last.to, insert: `\n${fence}` },
  ]);
}

/** Inserts a block of its own after the current line, separated by blank lines. */
function insertBlock(view: EditorView, text: string, cursorOffset: number): void {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const empty = line.text.trim() === "";
  const before = empty ? "" : "\n\n";
  const from = empty ? line.from : line.to;
  dispatchChanges(
    view,
    { from, to: line.to, insert: `${before}${text}` },
    EditorSelection.single(from + before.length + cursorOffset),
  );
}

function headingLevel(action: FormatAction): number | undefined {
  const match = /^heading([1-6])$/.exec(action);
  return match ? Number(match[1]) : undefined;
}

/** Applies a format to the selection. */
export function runFormatAction(
  view: EditorView,
  action: FormatAction,
  style: MarkdownStyle,
): void {
  const level = headingLevel(action);
  if (level !== undefined) return setHeading(view, level);
  switch (action) {
    case "bold":
      return toggleInline(view, "StrongEmphasis", style.strongMarker.repeat(2));
    case "italic":
      return toggleInline(view, "Emphasis", style.emphasisMarker);
    case "strikethrough":
      return toggleInline(view, "Strikethrough", "~~");
    case "inlineCode":
      return toggleInline(view, "InlineCode", "`");
    case "link":
      return toggleLink(view);
    case "paragraph":
      return setHeading(view, 0);
    case "quote":
      return toggleQuote(view);
    case "orderedList":
      return toggleList(view, true, style);
    case "bulletList":
      return toggleList(view, false, style);
    case "codeBlock":
      return insertFencedBlock(view, style.fenceMarker.repeat(3));
    case "mathBlock":
      return insertFencedBlock(view, "$$");
    case "table":
      return insertBlock(view, "|  |  |  |\n| --- | --- | --- |\n|  |  |  |\n", 2);
    case "divider":
      return insertBlock(view, `${style.ruleMarker.repeat(3)}\n`, 4);
    default:
      return undefined;
  }
}

/** Converts an Electron accelerator to a CodeMirror key name: "CmdOrCtrl+Shift+K" → "Mod-Shift-k". */
function toKeyName(accelerator: string): string {
  return accelerator
    .split("+")
    .map((part) => (part === "CmdOrCtrl" ? "Mod" : part.length === 1 ? part.toLowerCase() : part))
    .join("-");
}

/** The Typora-style formatting shortcuts, taken from the shared FORMAT_ACTIONS list. */
export function formatKeymap(style: () => MarkdownStyle): KeyBinding[] {
  return FORMAT_ACTIONS.flatMap(({ id, shortcut }) =>
    shortcut === undefined
      ? []
      : [
          {
            key: toKeyName(shortcut),
            run: (view: EditorView) => {
              runFormatAction(view, id, style());
              return true;
            },
          },
        ],
  );
}
