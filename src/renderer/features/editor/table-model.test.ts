import type { ChangeSpec, EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  alignColumn,
  columnCount,
  deleteColumn,
  deleteRow,
  deleteTable,
  editCell,
  insertColumn,
  insertRow,
  readTable,
  type TableModel,
} from "./table-model";
import { firstNode, markdownState } from "./testing";

const TABLE = "| Name | Age |\n| :--- | ---: |\n| Ann | 31 |\n| Bob | 27 |";

function tableOf(doc: string): [EditorState, TableModel] {
  const state = markdownState(doc);
  return [state, readTable(state, firstNode(state, "Table"))];
}

function apply(doc: string, edit: (state: EditorState, table: TableModel) => ChangeSpec): string {
  const [state, table] = tableOf(doc);
  return state.update({ changes: edit(state, table) }).state.doc.toString();
}

describe("readTable", () => {
  it("reads the cells, the alignments and the rows", () => {
    const [, table] = tableOf(TABLE);
    expect(table.alignments).toEqual(["start", "end"]);
    expect(table.rows.map((row) => row.cells.map((cell) => cell.text))).toEqual([
      ["Name", "Age"],
      ["Ann", "31"],
      ["Bob", "27"],
    ]);
    expect(columnCount(table)).toBe(2);
  });

  it("reads an escaped pipe as part of the cell", () => {
    const [, table] = tableOf("| a \\| b | c |\n| --- | --- |");
    expect(table.rows[0]?.cells.map((cell) => cell.text)).toEqual(["a | b", "c"]);
  });

  it("reads a table without outer pipes", () => {
    const [, table] = tableOf("a | b\n--- | ---\n1 | 2");
    expect(table.rows.map((row) => row.cells.map((cell) => cell.text))).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("table edits", () => {
  it("replaces only the text of the edited cell", () => {
    expect(apply(TABLE, (state, table) => editCell(state, table, 1, 0, "Anna"))).toBe(
      "| Name | Age |\n| :--- | ---: |\n| Anna | 31 |\n| Bob | 27 |",
    );
  });

  it("escapes what would end the cell", () => {
    expect(apply(TABLE, (state, table) => editCell(state, table, 1, 0, "a|b\nc"))).toContain(
      "| a\\|b c | 31 |",
    );
  });

  it("adds a cell a row is missing by rewriting the row", () => {
    const doc = "| a | b |\n| --- | --- |\n| 1 |";
    expect(apply(doc, (state, table) => editCell(state, table, 1, 1, "2"))).toBe(
      "| a | b |\n| --- | --- |\n| 1 | 2 |",
    );
  });

  it("inserts and deletes rows", () => {
    expect(apply(TABLE, (state, table) => insertRow(state, table, 2))).toBe(
      "| Name | Age |\n| :--- | ---: |\n| Ann | 31 |\n|  |  |\n| Bob | 27 |",
    );
    expect(apply(TABLE, (state, table) => deleteRow(state, table, 1))).toBe(
      "| Name | Age |\n| :--- | ---: |\n| Bob | 27 |",
    );
    expect(apply(TABLE, (state, table) => deleteRow(state, table, 0))).toBe(TABLE);
  });

  it("repeats the quote marker on an inserted row", () => {
    const quoted = "> | a |\n> | --- |\n> | 1 |";
    expect(apply(quoted, (state, table) => insertRow(state, table, 2))).toBe(
      "> | a |\n> | --- |\n> | 1 |\n> |  |",
    );
  });

  it("inserts, aligns and deletes columns", () => {
    expect(apply(TABLE, (state, table) => insertColumn(state, table, 1))).toBe(
      "| Name |  | Age |\n| :--- | --- | ---: |\n| Ann |  | 31 |\n| Bob |  | 27 |",
    );
    expect(apply(TABLE, (state, table) => alignColumn(state, table, 0, "center"))).toBe(
      "| Name | Age |\n| :---: | ---: |\n| Ann | 31 |\n| Bob | 27 |",
    );
    expect(apply(TABLE, (state, table) => deleteColumn(state, table, 0))).toBe(
      "| Age |\n| ---: |\n| 31 |\n| 27 |",
    );
  });

  it("deletes the whole table with its last column", () => {
    const doc = "Before\n\n| a |\n| --- |\n| 1 |\n\nAfter";
    expect(apply(doc, (state, table) => deleteColumn(state, table, 0))).toBe("Before\n\n\nAfter");
    expect(apply(doc, (state, table) => deleteTable(state, table))).toBe("Before\n\n\nAfter");
  });
});
