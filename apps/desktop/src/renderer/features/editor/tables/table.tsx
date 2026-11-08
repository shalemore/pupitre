import { syntaxTree } from "@codemirror/language";
import { type EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { createSignal, type Setter } from "solid-js";
import { render } from "solid-js/web";
import { fadeOut } from "@/features/editor/leave";
import { readTable, type TableModel } from "@/lib/markdown/table-model";
import type { CellPosition } from "./table-cell";
import { TableView } from "./table-view";

interface Mounted {
  setModel: Setter<TableModel>;
  setActive: Setter<CellPosition | undefined>;
  dispose: () => void;
}

const mounted = new WeakMap<HTMLElement, Mounted>();

/** A rendered, editable table; its DOM is kept across edits so the field being typed in stays. */
export class TableWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly model: TableModel,
  ) {
    super();
  }

  override eq(other: TableWidget): boolean {
    return other.source === this.source && other.model.from === this.model.from;
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement("div");
    container.className = "md-table-block";
    const [model, setModel] = createSignal(this.model);
    const [active, setActive] = createSignal<CellPosition>();
    const dispose = render(
      () => <TableView view={view} model={model} active={active} setActive={setActive} />,
      container,
    );
    mounted.set(container, { setModel, setActive, dispose });
    return container;
  }

  override updateDOM(dom: HTMLElement): boolean {
    const table = mounted.get(dom);
    if (!table) return false;
    table.setModel(this.model);
    return true;
  }

  override destroy(dom: HTMLElement): void {
    fadeOut(dom);
    mounted.get(dom)?.dispose();
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

/** Starts editing the cell at `pos` in the table widget rendered for `tableFrom`. */
function focusCell(view: EditorView, tableFrom: number, row: number, column: number): void {
  for (const dom of view.contentDOM.querySelectorAll<HTMLElement>(".md-table-block")) {
    if (view.posAtDOM(dom) !== tableFrom) continue;
    mounted.get(dom)?.setActive({ row, column });
    return;
  }
}

/**
 * A cursor that lands in a table's source, by arrow keys or a jump, moves into the cell at that
 * spot; the source itself is never shown.
 */
export const tableCursor = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate): void {
      if (!update.selectionSet || !update.view.hasFocus) return;
      const { state } = update;
      const head = state.selection.main.head;
      let node = syntaxTree(state).resolveInner(head, 1);
      while (node.parent && node.name !== "Table") node = node.parent;
      if (node.name !== "Table") return;
      const model = readTable(state, node);
      const row = Math.max(
        0,
        model.rows.findLastIndex((candidate) => state.doc.lineAt(candidate.from).from <= head),
      );
      const cells = model.rows[row]?.cells ?? [];
      const column = Math.max(
        0,
        cells.findLastIndex((cell) => cell.rawFrom <= head),
      );
      // Focus moves out of the editor, which must not happen during its update
      queueMicrotask(() => focusCell(update.view, model.from, row, column));
    }
  },
);
