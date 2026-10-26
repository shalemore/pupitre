import { syntaxTree } from "@codemirror/language";
import {
  type ChangeSpec,
  EditorSelection,
  type EditorState,
  type Line,
  type SelectionRange,
} from "@codemirror/state";
import type { Command, EditorView, KeyBinding } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { FORMAT_ACTIONS, type FormatAction } from "@shared/format";
import type { Settings } from "@shared/settings";
import { htmlTag } from "./html";

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

/** The innermost node named `name`, or matching the pattern, that contains the whole range. */
function enclosing(
  state: EditorState,
  range: SelectionRange,
  name: string | RegExp,
): SyntaxNode | undefined {
  const sides: (1 | -1)[] = range.empty ? [1, -1] : [1];
  for (const side of sides) {
    for (
      let node: SyntaxNode | null = syntaxTree(state).resolveInner(range.from, side);
      node;
      node = node.parent
    ) {
      const matched = typeof name === "string" ? node.name === name : name.test(node.name);
      if (matched && node.from <= range.from && node.to >= range.to) return node;
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

const UNDERLINE_OPEN = "<u>";
const UNDERLINE_CLOSE = "</u>";

/** The `<u>` and `</u>` tags that enclose the range, innermost first, if any pair does. */
function enclosingUnderline(
  state: EditorState,
  range: SelectionRange,
): { open: SyntaxNode; close: SyntaxNode } | undefined {
  const open: SyntaxNode[] = [];
  let pair: { open: SyntaxNode; close: SyntaxNode } | undefined;
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "HTMLTag") return;
      const tag = htmlTag(state.sliceDoc(node.from, node.to));
      if (tag?.name !== "u") return;
      if (!tag.closing) {
        open.push(node.node);
        return;
      }
      const opening = open.pop();
      // A tag that closes after the range pairs with the innermost tag that opened before it
      if (opening && opening.from <= range.from && node.to >= range.to) {
        pair = { open: opening, close: node.node };
      }
    },
  });
  return pair;
}

/**
 * Wraps each selection in the tags that give it the look, or takes them off when they already
 * enclose it. The live preview hides the tags of an element that pairs, so they look like Markdown.
 */
function toggleUnderline(view: EditorView): void {
  const { state } = view;
  view.dispatch(
    state.update(
      state.changeByRange((range) => {
        const pair = enclosingUnderline(state, range);
        if (pair) {
          const changes = state.changes([
            { from: pair.open.from, to: pair.open.to },
            { from: pair.close.from, to: pair.close.to },
          ]);
          return { changes, range: range.map(changes) };
        }
        return {
          changes: [
            { from: range.from, insert: UNDERLINE_OPEN },
            { from: range.to, insert: UNDERLINE_CLOSE },
          ],
          range: EditorSelection.range(
            range.anchor + UNDERLINE_OPEN.length,
            range.head + UNDERLINE_OPEN.length,
          ),
        };
      }),
      { scrollIntoView: true, userEvent: "input.format" },
    ),
  );
}

/** The inline formats whose syntax clearing takes off; a link keeps its text. */
const CLEARED_INLINE =
  /^(?:StrongEmphasis|Emphasis|Strikethrough|InlineCode|Highlight|Subscript|Superscript|Link)$/;

/** What clearing removes from inside an inline format: a marker, or a link's bracket or address. */
function removedByClearFormat(child: SyntaxNode): boolean {
  return child.name.endsWith("Mark") || child.name === "URL" || child.name === "LinkTitle";
}

/**
 * Takes the markers off the inline formats the selection covers and turns its links into their
 * text, leaving the blocks around them as they are. With no selection, the format the cursor is
 * in is the one cleared.
 */
function clearFormat(view: EditorView): void {
  const { state } = view;
  const tree = syntaxTree(state);
  const removals: { from: number; to: number }[] = [];
  for (const range of state.selection.ranges) {
    const format = range.empty ? enclosing(state, range, CLEARED_INLINE) : undefined;
    const from = format?.from ?? range.from;
    const to = format?.to ?? range.to;
    tree.iterate({
      from,
      to,
      enter: (node) => {
        // A format the selection covers only in part stays: clearing it would change what it holds
        if (!CLEARED_INLINE.test(node.name) || node.from < from || node.to > to) return;
        for (let child = node.node.firstChild; child; child = child.nextSibling) {
          if (removedByClearFormat(child)) removals.push({ from: child.from, to: child.to });
        }
      },
    });
  }
  if (removals.length === 0) return;
  dispatchChanges(
    view,
    removals.toSorted((a, b) => a.from - b.from),
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

/** Whether the line is part of a setext heading, whose level is written on the line below its text. */
function inSetextHeading(state: EditorState, pos: number): boolean {
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1);
    node;
    node = node.parent
  ) {
    if (node.name.startsWith("SetextHeading")) return true;
  }
  return false;
}

/**
 * Sets the heading level of each selected line to what `levelOf` makes of the level it has (0 for
 * a paragraph); a line it leaves undefined stays as it is.
 */
function changeHeadings(
  view: EditorView,
  levelOf: (line: Line, level: number) => number | undefined,
): void {
  const changes = selectedLines(view.state).flatMap((line) => {
    const start = line.from + (CONTAINER_PREFIX.exec(line.text)?.[0].length ?? 0);
    const existing = HEADING_PREFIX.exec(line.text.slice(start - line.from));
    const current = existing?.[1]?.length ?? 0;
    const level = levelOf(line, current);
    if (level === undefined) return [];
    const insert = level === 0 || level === current ? "" : `${"#".repeat(level)} `;
    return [{ from: start, to: start + (existing?.[0].length ?? 0), insert }];
  });
  if (changes.length > 0) dispatchChanges(view, changes);
}

/** Sets the heading level of the selected lines; the level they already have, or 0, makes them paragraphs. */
function setHeading(view: EditorView, level: number): void {
  changeHeadings(view, () => level);
}

/**
 * The level a step moves to: a heading goes one level up or down, H1 upwards and H6 downwards
 * give a paragraph, and a paragraph becomes a heading, since it has none to step from.
 */
function steppedHeadingLevel(level: number, direction: -1 | 1): number {
  if (level === 0) return 1;
  const next = level + direction;
  return next < 1 || next > 6 ? 0 : next;
}

/** Steps the heading level of each selected line, keeping a multi-line selection in step. */
function stepHeading(view: EditorView, direction: -1 | 1): void {
  const { state } = view;
  changeHeadings(view, (line, level) => {
    // A blank line has no level of its own, and a marker on it would make an empty heading
    if (line.text.trim() === "") return undefined;
    // A setext heading has no marker to step, and converting it would leave the line under its
    // text behind
    if (level === 0 && inSetextHeading(state, line.from)) return undefined;
    return steppedHeadingLevel(level, direction);
  });
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

/** The smallest positive footnote number the document does not use yet. */
function nextFootnoteLabel(state: EditorState): number {
  const used = new Set<number>();
  for (const match of state.doc.toString().matchAll(/\[\^(\d+)\]/g)) {
    const digits = match[1];
    if (digits !== undefined) used.add(Number(digits));
  }
  let label = 1;
  while (used.has(label)) label++;
  return label;
}

/** A footnote reference at the caret, and its definition after the last line of the document. */
function insertFootnote(view: EditorView): void {
  const { state } = view;
  const { from, to } = state.selection.main;
  const label = `[^${nextFootnoteLabel(state)}]`;
  // The definition is a block of its own, past the blank lines the document ends with; a last
  // line ending stays after it, as the file had one
  const end = Math.max(to, state.doc.toString().replace(/\n+$/, "").length);
  dispatchChanges(
    view,
    [
      { from, to, insert: label },
      { from: end, insert: `${end === 0 ? "" : "\n\n"}${label}: ` },
    ],
    EditorSelection.single(from + label.length),
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
    case "underline":
      return toggleUnderline(view);
    case "strikethrough":
      return toggleInline(view, "Strikethrough", "~~");
    case "highlight":
      return toggleInline(view, "Highlight", "==");
    case "subscript":
      return toggleInline(view, "Subscript", "~");
    case "superscript":
      return toggleInline(view, "Superscript", "^");
    case "clearFormat":
      return clearFormat(view);
    case "inlineMath":
      return toggleInline(view, "InlineMath", "$");
    case "toc":
      return insertBlock(view, "[TOC]\n", 6);
    case "footnote":
      return insertFootnote(view);
    case "headingUp":
      return stepHeading(view, -1);
    case "headingDown":
      return stepHeading(view, 1);
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

const PARAGRAPH_BLOCK = /^(?:Paragraph|ATXHeading[1-6])$/;

/**
 * Enter in a top-level paragraph or heading starts a new paragraph after a blank line, the way
 * Markdown is usually written. Only what Enter inserts follows this; existing text is never
 * reformatted. Lists and quotes are left to lang-markdown, which continues their markup.
 */
export const insertParagraphBreak: Command = ({ state, dispatch }) => {
  const { main } = state.selection;
  if (state.selection.ranges.length > 1 || !main.empty) return false;
  let block = syntaxTree(state).resolveInner(main.head, -1);
  while (block.parent && block.parent.name !== "Document") block = block.parent;
  if (!block.parent || !PARAGRAPH_BLOCK.test(block.name) || main.head > block.to) return false;
  // Spaces at the split would become the indentation of the new paragraph
  const line = state.doc.lineAt(main.head);
  const spaces = /^[ \t]*/.exec(line.text.slice(main.head - line.from))?.[0].length ?? 0;
  dispatch(
    state.update({
      changes: { from: main.head, to: main.head + spaces, insert: "\n\n" },
      selection: { anchor: main.head + 2 },
      scrollIntoView: true,
      userEvent: "input",
    }),
  );
  return true;
};

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
