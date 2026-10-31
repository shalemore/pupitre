import type { ChangeSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
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
import { type Accessor, type Component, type JSX, Show } from "solid-js";
import { IconButton, Separator } from "@/components/ui";
import { t } from "@/i18n";
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
} from "@/lib/markdown/table-model";
import { rtlFlip } from "@/lib/styles";
import { css, cx } from "@/styled-system/css";
import type { CellPosition } from "./table-cell";

const ToolButton: Component<{
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: JSX.Element;
}> = (props) => (
  <IconButton
    label={props.label}
    class={cx(props.danger && dangerButton)}
    // Keeps the focus, and with it the cell being edited, in the table
    onMouseDown={(event) => event.preventDefault()}
    onClick={() => props.onClick()}
  >
    {props.children}
  </IconButton>
);

const dangerButton = css({
  _hover: { backgroundColor: "destructive/10", color: "destructive" },
});
const deleted = css({ position: "relative", display: "inline-flex" });
const deletedCross = css({
  position: "absolute",
  insetInlineEnd: "-0.5",
  insetBlockEnd: "-0.5",
  width: "2",
  height: "2",
});
const toolbar = css({
  position: "absolute",
  insetBlockEnd: "100%",
  insetInlineStart: "0",
  zIndex: "10",
  marginBlockEnd: "1",
  display: "flex",
  alignItems: "center",
  gap: "0.5",
  borderRadius: "lg",
  backgroundColor: "popover",
  padding: "0.5",
  boxShadow: "float",
  animationName: "fadeInUpSmall",
  animationDuration: "base",
  animationTimingFunction: "enter",
  _print: { display: "none" },
});
const toolbarSeparator = css({ marginInline: "0.5", height: "4" });

/** A row or column with a cross on it, the way `Grid2x2X` marks a table that is deleted whole. */
const Deleted = (props: { children: JSX.Element }) => (
  <span class={deleted}>
    {props.children}
    <X class={deletedCross} stroke-width={2} />
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
    <div class={toolbar}>
      <ToolButton label={labels().alignStart} onClick={() => align("start")}>
        <TextAlignStart class={rtlFlip} />
      </ToolButton>
      <ToolButton label={labels().alignCenter} onClick={() => align("center")}>
        <TextAlignCenter />
      </ToolButton>
      <ToolButton label={labels().alignEnd} onClick={() => align("end")}>
        <TextAlignEnd class={rtlFlip} />
      </ToolButton>
      <Separator orientation="vertical" class={toolbarSeparator} />
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
        <BetweenVerticalStart class={rtlFlip} />
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
        <BetweenVerticalEnd class={rtlFlip} />
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
          <ArrowLeft class={rtlFlip} />
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
          <ArrowRight class={rtlFlip} />
        </ToolButton>
      </Show>
      <Separator orientation="vertical" class={toolbarSeparator} />
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
