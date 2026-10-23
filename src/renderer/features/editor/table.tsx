import type { EditorState } from "@codemirror/state";
import { type EditorView, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { type Component, For } from "solid-js";
import { render } from "solid-js/web";
import { InlineContent, type InlineItem, inlineItems } from "./inline-content";
import { openLink } from "./live-preview";

type Alignment = "start" | "center" | "end" | undefined;

interface Cell {
  /** Where the cell's text starts in the document, to put the cursor there on click. */
  pos: number;
  items: InlineItem[];
}

interface TableModel {
  /** Start of the table, where a click outside the cells puts the cursor. */
  from: number;
  alignments: Alignment[];
  header: Cell[];
  rows: Cell[][];
}

function alignment(spec: string): Alignment {
  const left = spec.startsWith(":");
  const right = spec.endsWith(":");
  if (left && right) return "center";
  if (right) return "end";
  return left ? "start" : undefined;
}

function cells(state: EditorState, row: SyntaxNode): Cell[] {
  return row.getChildren("TableCell").map((cell) => ({
    pos: cell.from,
    items: inlineItems(state, cell),
  }));
}

/** The table's rows and column alignments, read from its Lezer nodes. */
export function tableModel(state: EditorState, table: SyntaxNode): TableModel {
  const header = table.getChild("TableHeader");
  // The delimiter row (| :--- | ---: |) is the table's direct TableDelimiter child
  const delimiter = table.getChild("TableDelimiter");
  const specs = delimiter
    ? state
        .sliceDoc(delimiter.from, delimiter.to)
        .replace(/^\s*\|/, "")
        .replace(/\|\s*$/, "")
        .split("|")
        .map((spec) => spec.trim())
    : [];
  return {
    from: table.from,
    alignments: specs.map(alignment),
    header: header ? cells(state, header) : [],
    rows: table.getChildren("TableRow").map((row) => cells(state, row)),
  };
}

const TableView: Component<{ model: TableModel }> = (props) => {
  const align = (column: number) => props.model.alignments[column];
  return (
    <table class="md-table-view">
      <thead>
        <tr>
          <For each={props.model.header}>
            {(cell, column) => (
              <th data-pos={cell.pos} style={{ "text-align": align(column()) }}>
                <InlineContent items={cell.items} />
              </th>
            )}
          </For>
        </tr>
      </thead>
      <tbody>
        <For each={props.model.rows}>
          {(row) => (
            <tr>
              <For each={row}>
                {(cell, column) => (
                  <td data-pos={cell.pos} style={{ "text-align": align(column()) }}>
                    <InlineContent items={cell.items} />
                  </td>
                )}
              </For>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
};

const disposers = new WeakMap<HTMLElement, () => void>();

/** A rendered table; clicking a cell puts the cursor in that cell's source. */
export class TableWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly model: TableModel,
  ) {
    super();
  }

  override eq(other: TableWidget): boolean {
    return other.source === this.source;
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement("div");
    container.className = "md-table-block";
    disposers.set(
      container,
      render(() => <TableView model={this.model} />, container),
    );
    container.addEventListener("mousedown", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest(".md-link");
      if ((event.ctrlKey || event.metaKey) && link instanceof HTMLElement && link.title) {
        openLink(link.title);
      } else {
        const cell = target?.closest<HTMLElement>("[data-pos]");
        const pos = Number(cell?.dataset["pos"] ?? this.model.from);
        view.dispatch({ selection: { anchor: pos } });
        view.focus();
      }
      event.preventDefault();
    });
    return container;
  }

  override destroy(dom: HTMLElement): void {
    disposers.get(dom)?.();
  }

  override ignoreEvent(event: Event): boolean {
    return event.type === "mousedown";
  }
}
