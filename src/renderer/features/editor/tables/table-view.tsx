import { redo, undo } from "@codemirror/commands";
import type { ChangeSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { type Accessor, type Component, createSelector, Index, type Setter, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { openImageMenu } from "@/features/editor/images/image-menu";
import { openLink } from "@/features/editor/preview/links";
import { InlineContent } from "@/features/editor/tables/inline-view";
import { imageIn } from "@/lib/markdown/images";
import { columnCount, editCell, insertRow, type TableModel } from "@/lib/markdown/table-model";
import { css, cx } from "@/styled-system/css";
import { type CellPosition, TableCellImage } from "./table-cell";
import { TableToolbar } from "./table-toolbar";

/**
 * Tables are always shown rendered and edited in place, like the rest of the live preview: the
 * cell being edited shows its Markdown in a text field, the others show it rendered. Every edit
 * goes through the document (table-model.ts), so undo, saving and the source stay in step.
 */

interface TableViewProps {
  view: EditorView;
  model: Accessor<TableModel>;
  active: Accessor<CellPosition | undefined>;
  setActive: Setter<CellPosition | undefined>;
}

const tableRoot = css({ position: "relative" });
const scrollX = css({ overflowX: "auto" });
const tableElement = css({ borderCollapse: "collapse" });

export const TableView: Component<TableViewProps> = (props) => {
  const { view } = props;
  const columns = () => columnCount(props.model());
  const rows = () => props.model().rows.length;
  // Each cell subscribes to its own boolean, so moving the editing touches two cells, not the table
  const activeCell = createSelector(() => {
    const cell = props.active();
    return cell === undefined ? "" : `${cell.row}:${cell.column}`;
  });
  const isActive = (row: number, column: number) => activeCell(`${row}:${column}`);

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
          // The handle and the alignment bar keep the picture in place while they are used
          if (
            event.target instanceof Element &&
            event.target.closest(".md-image-handle, .md-image-toolbar") !== null
          ) {
            return;
          }
          // A right-click on a picture keeps the picture there for its own menu
          if (event.button !== 0) return;
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
        onContextMenu={(event: MouseEvent) => {
          if (
            !(event.target instanceof Element) ||
            event.target.closest("img.md-image-preview") === null
          ) {
            return;
          }
          const cellSource = source();
          const image =
            cellSource === undefined
              ? undefined
              : imageIn(props.view.state, cellSource.from, cellSource.to);
          if (image === undefined || !openImageMenu(props.view, event, image)) return;
          event.stopPropagation();
        }}
      >
        <Show
          when={isActive(cell.row, cell.column)}
          fallback={
            <InlineContent
              items={source()?.items ?? []}
              renderImage={(image) => <TableCellImage view={props.view} image={image} />}
            />
          }
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
      class={tableRoot}
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
      <div class={scrollX}>
        <table class={cx("md-table-view", "md-text-cursor", tableElement)}>
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
