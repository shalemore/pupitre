import { createSignal, onMount, type Component } from "solid-js";
import { Button, Input, Sheet } from "@/components/ui";
import { t } from "@/i18n";
import { css } from "@/styled-system/css";

/** The rows count the header, so three rows are a header row and two body rows. */
const ROWS = { min: 1, max: 20, initial: 3 } as const;
const COLUMNS = { min: 1, max: 12, initial: 3 } as const;

interface Size {
  readonly min: number;
  readonly max: number;
  readonly initial: number;
}

/** The size a field holds, kept inside its bounds; an empty field stands for the size it started at. */
function sizeOf(text: string, size: Size): number {
  const value = Number.parseInt(text, 10);
  if (Number.isNaN(value)) return size.initial;
  return Math.min(Math.max(value, size.min), size.max);
}

const field = css({ display: "flex", minWidth: 0, flex: "1", flexDirection: "column", gap: "1" });
const fieldLabel = css({ textStyle: "2xs", color: "muted.foreground" });
const fields = css({ display: "flex", alignItems: "flex-end", gap: "2" });
const actions = css({ display: "flex", justifyContent: "flex-end", gap: "2" });

/** A count the table is written with, and its name beside it. */
const SizeField: Component<{
  label: string;
  size: Size;
  text: string;
  onTextChange: (text: string) => void;
  ref?: (input: HTMLInputElement) => void;
}> = (props) => (
  <label class={field}>
    <span class={fieldLabel}>{props.label}</span>
    <Input
      ref={props.ref}
      type="number"
      min={props.size.min}
      max={props.size.max}
      value={props.text}
      onInput={(event) => props.onTextChange(event.currentTarget.value)}
      // A number past the last one the table can have shows the bound it keeps instead
      onChange={(event) =>
        props.onTextChange(String(sizeOf(event.currentTarget.value, props.size)))
      }
    />
  </label>
);

export interface TableSizeDialogProps {
  /** Writes the table into the document and closes the dialog. */
  onInsert: (rows: number, columns: number) => void;
  onClose: () => void;
}

/**
 * Asks for the size of the table that Paragraph › Insert Table writes. Enter writes the table and
 * Escape leaves the document as it was; the caret starts in the field of the row count.
 */
export const TableSizeDialog: Component<TableSizeDialogProps> = (props) => {
  const [rows, setRows] = createSignal(String(ROWS.initial));
  const [columns, setColumns] = createSignal(String(COLUMNS.initial));
  let rowsInput: HTMLInputElement | undefined;

  onMount(() => {
    rowsInput?.focus();
    rowsInput?.select();
  });

  const insert = () => props.onInsert(sizeOf(rows(), ROWS), sizeOf(columns(), COLUMNS));

  return (
    <Sheet
      title={t().editor.tableSize.title}
      onClose={props.onClose}
      onKeyDown={(event) => {
        // Enter confirming an input method's candidate must not write the table
        if (event.isComposing) return;
        if (event.key === "Escape") {
          event.preventDefault();
          props.onClose();
        } else if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
          event.preventDefault();
          insert();
        }
      }}
    >
      <div class={fields}>
        <SizeField
          label={t().editor.tableSize.rows}
          size={ROWS}
          text={rows()}
          onTextChange={setRows}
          ref={(input) => (rowsInput = input)}
        />
        <SizeField
          label={t().editor.tableSize.columns}
          size={COLUMNS}
          text={columns()}
          onTextChange={setColumns}
        />
      </div>
      <div class={actions}>
        <Button variant="ghost" size="sm" onClick={() => props.onClose()}>
          {t().dialogs.cancel}
        </Button>
        <Button variant="brand" size="sm" onClick={() => insert()}>
          {t().editor.tableSize.insert}
        </Button>
      </div>
    </Sheet>
  );
};
