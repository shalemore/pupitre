import { redo, undo } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";
import type { ChangeSpec } from "@codemirror/state";
import { type EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { cn } from "cn";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Columns2,
  Grid2x2X,
  Rows2,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  X,
} from "lucide-solid";
import {
  type Accessor,
  type Component,
  createSignal,
  Index,
  type JSX,
  type Setter,
  Show,
} from "solid-js";
import { Dynamic, render } from "solid-js/web";
import { IconButton, Separator } from "@/components/ui";
import { t } from "@/i18n";
import { InlineContent } from "./inline-content";
import { openLink } from "./live-preview";
import {
  type Alignment,
  alignColumn,
  columnCount,
  deleteColumn,
  deleteRow,
  deleteTable,
  editCell,
  insertColumn,
  insertRow,
  moveColumn,
  moveRow,
  readTable,
  type TableModel,
} from "./table-model";

/**
 * Tables are always shown rendered and edited in place, like the rest of the live preview: the
 * cell being edited shows its Markdown in a text field, the others show it rendered. Every edit
 * goes through the document (table-model.ts), so undo, saving and the source stay in step.
 */

interface CellPosition {
  row: number;
  column: number;
}

interface TableViewProps {
  view: EditorView;
  model: Accessor<TableModel>;
  active: Accessor<CellPosition | undefined>;
  setActive: Setter<CellPosition | undefined>;
}

const ToolButton: Component<{
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: JSX.Element;
}> = (props) => (
  <IconButton
    label={props.label}
    class={cn(props.danger && "hover:bg-destructive/10 hover:text-destructive")}
    // Keeps the focus, and with it the cell being edited, in the table
    onMouseDown={(event) => event.preventDefault()}
    onClick={() => props.onClick()}
  >
    {props.children}
  </IconButton>
);

/** A row or column with a cross on it, the way `Grid2x2X` marks a table that is deleted whole. */
const Deleted = (props: { children: JSX.Element }) => (
  <span class="relative inline-flex">
    {props.children}
    <X class="absolute -inset-e-0.5 -inset-be-0.5 size-2" stroke-width={2} />
  </span>
);

/** Floats above the table while a cell is edited; acts on that cell's row and column. */
const TableToolbar: Component<{
  cell: CellPosition;
  model: Accessor<TableModel>;
  view: EditorView;
  run: (edit: (model: TableModel) => ChangeSpec, focus?: CellPosition) => void;
}> = (props) => {
  const labels = () => t().editor.table;
  const state = () => props.view.state;
  const row = () => props.cell.row;
  const column = () => props.cell.column;
  const rowTotal = () => props.model().rows.length;
  const columnTotal = () => columnCount(props.model());
  const align = (value: Alignment) =>
    props.run((model) => alignColumn(state(), model, column(), value), props.cell);

  return (
    <div class="absolute bottom-full inset-s-0 z-10 mb-1 flex items-center gap-0.5 rounded-lg bg-popover p-0.5 shadow-float animate-in fade-in-0 slide-in-from-bottom-1 duration-base print:hidden">
      <ToolButton label={labels().alignStart} onClick={() => align("start")}>
        <TextAlignStart />
      </ToolButton>
      <ToolButton label={labels().alignCenter} onClick={() => align("center")}>
        <TextAlignCenter />
      </ToolButton>
      <ToolButton label={labels().alignEnd} onClick={() => align("end")}>
        <TextAlignEnd />
      </ToolButton>
      <Separator orientation="vertical" class="mx-0.5 h-4" />
      <Show when={row() > 0}>
        <ToolButton
          label={labels().insertRowAbove}
          onClick={() => props.run((model) => insertRow(state(), model, row()), props.cell)}
        >
          <BetweenHorizontalStart />
        </ToolButton>
      </Show>
      <ToolButton
        label={labels().insertRowBelow}
        onClick={() =>
          props.run((model) => insertRow(state(), model, row() + 1), {
            row: row() + 1,
            column: column(),
          })
        }
      >
        <BetweenHorizontalEnd />
      </ToolButton>
      <ToolButton
        label={labels().insertColumnBefore}
        onClick={() => props.run((model) => insertColumn(state(), model, column()), props.cell)}
      >
        <BetweenVerticalStart />
      </ToolButton>
      <ToolButton
        label={labels().insertColumnAfter}
        onClick={() =>
          props.run((model) => insertColumn(state(), model, column() + 1), {
            row: row(),
            column: column() + 1,
          })
        }
      >
        <BetweenVerticalEnd />
      </ToolButton>
      {/* Only body rows move: the header line says what the columns hold and stays first */}
      <Show when={row() > 1}>
        <ToolButton
          label={labels().moveRowUp}
          onClick={() =>
            props.run((model) => moveRow(state(), model, row(), -1), {
              row: row() - 1,
              column: column(),
            })
          }
        >
          <ArrowUp />
        </ToolButton>
      </Show>
      <Show when={row() > 0 && row() < rowTotal() - 1}>
        <ToolButton
          label={labels().moveRowDown}
          onClick={() =>
            props.run((model) => moveRow(state(), model, row(), 1), {
              row: row() + 1,
              column: column(),
            })
          }
        >
          <ArrowDown />
        </ToolButton>
      </Show>
      <Show when={column() > 0}>
        <ToolButton
          label={labels().moveColumnBefore}
          onClick={() =>
            props.run((model) => moveColumn(state(), model, column(), -1), {
              row: row(),
              column: column() - 1,
            })
          }
        >
          <ArrowLeft />
        </ToolButton>
      </Show>
      <Show when={column() < columnTotal() - 1}>
        <ToolButton
          label={labels().moveColumnAfter}
          onClick={() =>
            props.run((model) => moveColumn(state(), model, column(), 1), {
              row: row(),
              column: column() + 1,
            })
          }
        >
          <ArrowRight />
        </ToolButton>
      </Show>
      <Separator orientation="vertical" class="mx-0.5 h-4" />
      <Show when={row() > 0}>
        <ToolButton
          label={labels().deleteRow}
          danger
          onClick={() =>
            props.run((model) => deleteRow(state(), model, row()), {
              row: row() - 1,
              column: column(),
            })
          }
        >
          <Deleted>
            <Rows2 />
          </Deleted>
        </ToolButton>
      </Show>
      <ToolButton
        label={labels().deleteColumn}
        danger
        onClick={() =>
          props.run((model) => deleteColumn(state(), model, column()), {
            row: row(),
            column: Math.max(0, column() - 1),
          })
        }
      >
        <Deleted>
          <Columns2 />
        </Deleted>
      </ToolButton>
      <ToolButton
        label={labels().deleteTable}
        danger
        onClick={() => props.run((model) => deleteTable(state(), model))}
      >
        <Grid2x2X />
      </ToolButton>
    </div>
  );
};

const TableView: Component<TableViewProps> = (props) => {
  const { view } = props;
  const columns = () => columnCount(props.model());
  const rows = () => props.model().rows.length;
  const isActive = (row: number, column: number) =>
    props.active()?.row === row && props.active()?.column === column;

  /** Applies an edit built from the current table, then moves the editing to `focus`. */
  const run = (edit: (model: TableModel) => ChangeSpec, focus?: CellPosition) => {
    view.dispatch({ changes: edit(props.model()), userEvent: "input" });
    if (focus) props.setActive({ ...focus });
    else view.focus();
  };

  /** Leaves the table for the line before or after it, adding an empty line at the document's edge. */
  const leave = (direction: "before" | "after") => {
    const { from, to } = props.model();
    const { doc } = view.state;
    if (direction === "before") {
      if (from === 0)
        view.dispatch({ changes: { from: 0, insert: "\n" }, selection: { anchor: 0 } });
      else view.dispatch({ selection: { anchor: from - 1 } });
    } else if (to === doc.length) {
      view.dispatch({ changes: { from: to, insert: "\n" }, selection: { anchor: to + 1 } });
    } else {
      view.dispatch({ selection: { anchor: to + 1 } });
    }
    props.setActive(undefined);
    view.focus();
  };

  const moveTo = (row: number, column: number) => {
    if (row < 0) return leave("before");
    if (row >= rows()) return leave("after");
    props.setActive({ row, column: Math.min(Math.max(column, 0), columns() - 1) });
  };

  const keyDown = (event: KeyboardEvent, input: HTMLInputElement, row: number, column: number) => {
    if (event.isComposing) return;
    const mod = event.ctrlKey || event.metaKey;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd = input.selectionStart === input.value.length;
    const lastColumn = columns() - 1;
    const lastRow = rows() - 1;
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    if (mod && (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y")) {
      handled();
      if (event.key.toLowerCase() === "y" || event.shiftKey) redo(view);
      else undo(view);
      // The field holds what the user typed; after an undo the document says what it shows
      input.value = props.model().rows[row]?.cells[column]?.text ?? "";
      return;
    }
    switch (event.key) {
      case "Tab":
        handled();
        if (event.shiftKey) {
          if (column > 0) moveTo(row, column - 1);
          else if (row > 0) moveTo(row - 1, lastColumn);
        } else if (column < lastColumn) {
          moveTo(row, column + 1);
        } else if (row < lastRow) {
          moveTo(row + 1, 0);
        } else {
          run((model) => insertRow(view.state, model, row + 1), { row: row + 1, column: 0 });
        }
        return;
      case "Enter":
        handled();
        if (row < lastRow && !mod) moveTo(row + 1, column);
        else run((model) => insertRow(view.state, model, row + 1), { row: row + 1, column });
        return;
      case "ArrowUp":
        handled();
        return moveTo(row - 1, column);
      case "ArrowDown":
        handled();
        return moveTo(row + 1, column);
      case "ArrowLeft":
      case "ArrowRight": {
        // Logical direction, so arrows follow the text in a right-to-left table
        const rtl = getComputedStyle(input).direction === "rtl";
        const backward = (event.key === "ArrowLeft") !== rtl;
        if (event.shiftKey || (backward ? !atStart : !atEnd)) return;
        handled();
        if (backward) {
          if (column > 0) moveTo(row, column - 1);
          else moveTo(row - 1, lastColumn);
        } else if (column < lastColumn) {
          moveTo(row, column + 1);
        } else {
          moveTo(row + 1, 0);
        }
        return;
      }
      case "Escape":
        handled();
        return leave("after");
      default:
        return;
    }
  };

  const Cell: Component<{ row: number; column: number }> = (cell) => {
    const source = () => props.model().rows[cell.row]?.cells[cell.column];
    return (
      <Dynamic
        component={cell.row === 0 ? "th" : "td"}
        style={{ "text-align": props.model().alignments[cell.column] }}
        onMouseDown={(event: MouseEvent) => {
          const link = event.target instanceof Element ? event.target.closest(".md-link") : null;
          if ((event.ctrlKey || event.metaKey) && link instanceof HTMLElement && link.title) {
            openLink(link.title);
            event.preventDefault();
            return;
          }
          if (isActive(cell.row, cell.column)) return;
          event.preventDefault();
          props.setActive({ row: cell.row, column: cell.column });
        }}
      >
        <Show
          when={isActive(cell.row, cell.column)}
          fallback={<InlineContent items={source()?.items ?? []} />}
        >
          <input
            class="md-table-input"
            dir="auto"
            spellcheck={false}
            ref={(input) => {
              input.value = source()?.text ?? "";
              queueMicrotask(() => {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
              });
            }}
            onInput={(event) =>
              view.dispatch({
                changes: editCell(
                  view.state,
                  props.model(),
                  cell.row,
                  cell.column,
                  event.currentTarget.value,
                ),
                userEvent: "input.type",
              })
            }
            onKeyDown={(event) => keyDown(event, event.currentTarget, cell.row, cell.column)}
          />
        </Show>
      </Dynamic>
    );
  };

  const header = () => props.model().rows.slice(0, 1);
  const body = () => props.model().rows.slice(1);
  const columnIndexes = () => Array.from({ length: columns() }, (_, index) => index);

  return (
    <div
      class="relative"
      onFocusOut={(event) => {
        const container = event.currentTarget;
        // Moving to another cell swaps one field for another; only leaving the table ends editing
        queueMicrotask(() => {
          if (!container.contains(document.activeElement)) props.setActive(undefined);
        });
      }}
    >
      <Show when={props.active()}>
        {(cell) => <TableToolbar cell={cell()} model={props.model} run={run} view={view} />}
      </Show>
      <div class="md-table-scroll">
        <table class="md-table-view">
          <thead>
            <Index each={header()}>
              {() => (
                <tr>
                  <Index each={columnIndexes()}>
                    {(column) => <Cell row={0} column={column()} />}
                  </Index>
                </tr>
              )}
            </Index>
          </thead>
          <tbody>
            <Index each={body()}>
              {(_, index) => (
                <tr>
                  <Index each={columnIndexes()}>
                    {(column) => <Cell row={index + 1} column={column()} />}
                  </Index>
                </tr>
              )}
            </Index>
          </tbody>
        </table>
      </div>
    </div>
  );
};

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
