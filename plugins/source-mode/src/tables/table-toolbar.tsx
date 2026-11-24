import type { ChangeSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { t } from "@pupitre/i18n/solid";
import {
  type Alignment,
  alignColumn,
  columnCount,
  deleteColumn,
  deleteRow,
  deleteTable,
  insertColumn,
  insertRow,
  moveColumn,
  moveRow,
  type TableModel,
} from "@pupitre/markdown";
import { cn, IconButton, Separator } from "@pupitre/ui";
import type { JSX } from "@solidjs/web";
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
import { type Accessor, type Component, Show } from "solid-js";
import type { CellPosition } from "./table-cell";

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

const ToolbarSeparator: Component = () => <Separator orientation="vertical" class="mx-0.5 h-4" />;

/** A row or column with a cross on it, the way `Grid2x2X` marks a table that is deleted whole. */
const Deleted = (props: { children: JSX.Element }) => (
  <span class="relative inline-flex">
    {props.children}
    <X class="absolute -inset-e-0.5 -bottom-0.5 size-2" stroke-width={2} />
  </span>
);

/** Floats above the table while a cell is edited; acts on that cell's row and column. */
export const TableToolbar: Component<{
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
    <div class="__FLOATING_PANEL__ absolute inset-s-0 bottom-full z-10 mb-1 flex animate-fade-in-up-small items-center gap-0.5 p-0.5 print:hidden">
      <ToolButton label={labels().alignStart} onClick={() => align("start")}>
        <TextAlignStart class="rtl:-scale-x-100" />
      </ToolButton>
      <ToolButton label={labels().alignCenter} onClick={() => align("center")}>
        <TextAlignCenter />
      </ToolButton>
      <ToolButton label={labels().alignEnd} onClick={() => align("end")}>
        <TextAlignEnd class="rtl:-scale-x-100" />
      </ToolButton>
      <ToolbarSeparator />
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
        <BetweenVerticalStart class="rtl:-scale-x-100" />
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
        <BetweenVerticalEnd class="rtl:-scale-x-100" />
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
          <ArrowLeft class="rtl:-scale-x-100" />
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
          <ArrowRight class="rtl:-scale-x-100" />
        </ToolButton>
      </Show>
      <ToolbarSeparator />
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
