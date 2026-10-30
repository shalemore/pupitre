import type { ChangeSpec, EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import { type InlineItem, inlineItems } from "./inline";

/**
 * A GFM table read from its source, with the position of every cell, and the text edits that
 * change it. Editing a cell replaces only that cell's text, so the rest of the table keeps its
 * formatting; adding, removing or aligning rows and columns rewrites the affected row lines.
 */

export type Alignment = "start" | "center" | "end" | undefined;

interface TableCell {
  /** The cell's text without the spaces around it; from equals to for an empty cell. */
  from: number;
  to: number;
  /** Between the pipes, spaces included. */
  rawFrom: number;
  rawTo: number;
  /** The cell's Markdown with `\|` read as a plain pipe, as it is edited. */
  text: string;
  items: InlineItem[];
}

interface TableRow {
  /** The row's text, after any quote or list indentation in front of it. */
  from: number;
  to: number;
  cells: TableCell[];
}

export interface TableModel {
  /** Start of the line of the header and end of the line of the last row. */
  from: number;
  to: number;
  alignments: Alignment[];
  /** The header row first, then the body rows; the delimiter row is not among them. */
  rows: TableRow[];
  delimiter: TableRow;
}

function alignment(spec: string): Alignment {
  const left = spec.startsWith(":");
  const right = spec.endsWith(":");
  if (left && right) return "center";
  if (right) return "end";
  return left ? "start" : undefined;
}

function delimiterCell(align: Alignment): string {
  switch (align) {
    case "start":
      return ":---";
    case "center":
      return ":---:";
    case "end":
      return "---:";
    default:
      return "---";
  }
}

/** Splits a row's source at its unescaped pipes, leaving out the optional outer pipes. */
function splitRow(state: EditorState, from: number, to: number): { from: number; to: number }[] {
  const text = state.sliceDoc(from, to);
  const pipes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === "|") pipes.push(i);
  }
  const start = text.search(/\S/);
  const end = text.trimEnd().length;
  const bounds = [pipes[0] === start ? start + 1 : 0];
  for (const pipe of pipes) if (pipe !== start && pipe !== end - 1) bounds.push(pipe, pipe + 1);
  bounds.push(pipes.at(-1) === end - 1 && end - 1 !== start ? end - 1 : text.length);
  const segments = [];
  for (let i = 0; i + 1 < bounds.length; i += 2) {
    segments.push({ from: from + (bounds[i] ?? 0), to: from + (bounds[i + 1] ?? 0) });
  }
  return segments;
}

function readRow(state: EditorState, row: SyntaxNode): TableRow {
  const lezerCells = row.getChildren("TableCell");
  const cells = splitRow(state, row.from, row.to).map(({ from: rawFrom, to: rawTo }) => {
    const raw = state.sliceDoc(rawFrom, rawTo);
    const from = rawFrom + (raw.length - raw.trimStart().length);
    const to = Math.max(from, rawTo - (raw.length - raw.trimEnd().length));
    const node = lezerCells.find((cell) => cell.from >= rawFrom && cell.to <= rawTo);
    return {
      from,
      to,
      rawFrom,
      rawTo,
      text: state.sliceDoc(from, to).replaceAll("\\|", "|"),
      items: node ? inlineItems(state, node) : [],
    };
  });
  return { from: row.from, to: row.to, cells };
}

export function readTable(state: EditorState, table: SyntaxNode): TableModel {
  const header = table.getChild("TableHeader");
  const delimiterNode = table.getChild("TableDelimiter");
  const rows = [
    ...(header ? [readRow(state, header)] : []),
    ...table.getChildren("TableRow").map((row) => readRow(state, row)),
  ];
  const delimiter = delimiterNode
    ? readRow(state, delimiterNode)
    : { from: table.from, to: table.from, cells: [] };
  return {
    from: state.doc.lineAt(table.from).from,
    to: state.doc.lineAt(table.to).to,
    alignments: delimiter.cells.map((cell) => alignment(state.sliceDoc(cell.from, cell.to))),
    rows,
    delimiter,
  };
}

export function columnCount(table: TableModel): number {
  return Math.max(table.delimiter.cells.length, ...table.rows.map((row) => row.cells.length));
}

/** Escapes what would end the cell; a cell is a single line. */
function cellSource(text: string): string {
  return text.replaceAll(/\r?\n/g, " ").replaceAll("|", "\\|");
}

function rowSource(cells: readonly string[]): string {
  return `| ${cells.join(" | ")} |`;
}

/**
 * The source of an empty table of `rows` rows and `columns` columns, the header row first and the
 * delimiter row right after it, with a line ending after each line.
 */
export function emptyTableSource(rows: number, columns: number): string {
  const empty = Array.from({ length: columns }, () => "");
  const header = rowSource(empty);
  const delimiter = rowSource(empty.map(() => delimiterCell(undefined)));
  const body = Array.from({ length: Math.max(rows - 1, 0) }, () => header);
  return [header, delimiter, ...body].map((line) => `${line}\n`).join("");
}

/** Replaces a cell's text; a missing cell is added by rewriting its row. */
export function editCell(
  state: EditorState,
  table: TableModel,
  row: number,
  column: number,
  text: string,
): ChangeSpec {
  const target = table.rows[row];
  if (!target) return [];
  const cell = target.cells[column];
  if (!cell) {
    const cells = Array.from({ length: columnCount(table) }, (_, index) =>
      index === column ? cellSource(text) : cellText(state, target, index),
    );
    return { from: target.from, to: target.to, insert: rowSource(cells) };
  }
  if (cell.from < cell.to) return { from: cell.from, to: cell.to, insert: cellSource(text) };
  return { from: cell.rawFrom, to: cell.rawTo, insert: text ? ` ${cellSource(text)} ` : "  " };
}

/** A cell's source text, empty for a cell the row does not have. */
function cellText(state: EditorState, row: TableRow, column: number): string {
  const cell = row.cells[column];
  return cell ? state.sliceDoc(cell.from, cell.to) : "";
}

/** Rewrites every row (the delimiter row included) from its cells after `edit` reshapes them. */
function rewriteRows(
  state: EditorState,
  table: TableModel,
  edit: (cells: string[], isDelimiter: boolean) => string[],
): ChangeSpec[] {
  const columns = columnCount(table);
  const read = (row: TableRow) =>
    Array.from({ length: columns }, (_, index) => cellText(state, row, index));
  const delimiter = Array.from({ length: columns }, (_, index) =>
    delimiterCell(table.alignments[index]),
  );
  const [header, ...body] = table.rows;
  return [
    ...(header
      ? [{ from: header.from, to: header.to, insert: rowSource(edit(read(header), false)) }]
      : []),
    {
      from: table.delimiter.from,
      to: table.delimiter.to,
      insert: rowSource(edit(delimiter, true)),
    },
    ...body.map((row) => ({
      from: row.from,
      to: row.to,
      insert: rowSource(edit(read(row), false)),
    })),
  ];
}

/** Inserts an empty body row before the row at `index` (1 is the first body row). */
export function insertRow(state: EditorState, table: TableModel, index: number): ChangeSpec {
  const columns = columnCount(table);
  const empty = rowSource(Array.from({ length: columns }, () => ""));
  // The new line repeats the quote or list indentation the table sits in
  const after = (index > 1 && table.rows[index - 1]) || table.delimiter;
  const line = state.doc.lineAt(after.from);
  const prefix = state.sliceDoc(line.from, after.from);
  return { from: line.to, insert: `\n${prefix}${empty}` };
}

export function deleteRow(state: EditorState, table: TableModel, index: number): ChangeSpec {
  const row = table.rows[index];
  if (!row || index === 0) return [];
  const line = state.doc.lineAt(row.from);
  return { from: line.from - 1, to: line.to };
}

/**
 * Moves the body row at `index` by `delta` places, swapping the rows' source with each other. The
 * rows keep the spacing and the escaping they were written with; only their order changes, and the
 * header stays first because it is the line that says what the table holds.
 */
export function moveRow(
  state: EditorState,
  table: TableModel,
  index: number,
  delta: number,
): ChangeSpec {
  const target = index + delta;
  const row = table.rows[index];
  const other = table.rows[target];
  if (!row || !other || index < 1 || target < 1) return [];
  return [
    { from: row.from, to: row.to, insert: state.sliceDoc(other.from, other.to) },
    { from: other.from, to: other.to, insert: state.sliceDoc(row.from, row.to) },
  ];
}

export function insertColumn(state: EditorState, table: TableModel, index: number): ChangeSpec {
  return rewriteRows(state, table, (cells, isDelimiter) =>
    cells.toSpliced(index, 0, isDelimiter ? delimiterCell(undefined) : ""),
  );
}

export function deleteColumn(state: EditorState, table: TableModel, index: number): ChangeSpec {
  if (columnCount(table) <= 1) return deleteTable(state, table);
  return rewriteRows(state, table, (cells) => cells.toSpliced(index, 1));
}

/** The cells with the two at `a` and `b` exchanged. */
function swapCells(cells: readonly string[], a: number, b: number): string[] {
  const next = [...cells];
  const first = next[a] ?? "";
  next[a] = next[b] ?? "";
  next[b] = first;
  return next;
}

/** Moves the column at `index` by `delta` places, its alignment, heading and cells along with it. */
export function moveColumn(
  state: EditorState,
  table: TableModel,
  index: number,
  delta: number,
): ChangeSpec {
  const target = index + delta;
  if (target === index || target < 0 || target >= columnCount(table)) return [];
  return rewriteRows(state, table, (cells) => swapCells(cells, index, target));
}

export function alignColumn(
  state: EditorState,
  table: TableModel,
  index: number,
  align: Alignment,
): ChangeSpec {
  return rewriteRows(state, table, (cells, isDelimiter) =>
    isDelimiter ? cells.with(index, delimiterCell(align)) : cells,
  );
}

/** Removes the table's lines, and the line break after them. */
export function deleteTable(state: EditorState, table: TableModel): ChangeSpec {
  const to = Math.min(state.doc.length, table.to + 1);
  return { from: table.from, to };
}
