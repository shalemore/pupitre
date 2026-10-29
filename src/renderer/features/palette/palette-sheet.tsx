import { Combobox as KobalteCombobox } from "@kobalte/core/combobox";
import { createMemo, createSignal, type JSX, onMount, Show } from "solid-js";
import { Input, ScrollView, Sheet, type ScrollViewProps } from "@/components/ui";
import { FocusFirstRow, ShowFocusedRow } from "@/lib/combobox-rows";

export interface PaletteSheetProps<Item> {
  /** Names the sheet and the list it holds, for anyone who cannot see it. */
  title: string;
  placeholder: string;
  /** The rows the typed query picks, in the order they are shown. */
  rows: (query: string) => readonly Item[];
  /** What an empty list means; undefined leaves the room to rows that are still on their way. */
  emptyMessage: string | undefined;
  /** A line under the list, for what picking a row does when the rows themselves do not say. */
  hint?: string | undefined;
  /** Runs the row that was picked, by Enter or by pointer; the sheet closes behind it. */
  onPick: (item: Item) => void;
  onClose: () => void;
  /** The content of one row; the sheet draws the row itself. */
  children: (item: Item) => JSX.Element;
}

/** A row with the key the list knows it by; the place in the list keeps the first row first as the query narrows. */
interface Row<Item> {
  key: string;
  item: Item;
}

function isRowList<Item>(value: unknown): value is readonly Row<Item>[] {
  return Array.isArray(value);
}

/**
 * The row a selection change carries. A single selection is typed as one option, but the combobox
 * hands the selected keys over as a list.
 */
function selectedRow<Item>(
  selected: Row<Item> | readonly Row<Item>[] | null,
): Row<Item> | undefined {
  return isRowList<Item>(selected) ? selected[0] : (selected ?? undefined);
}

/**
 * The panel a palette is: a query field over the rows it picks, walked with the arrow keys and run
 * with Enter. It covers the window and hands the focus back to whatever held it before, whichever
 * way it was closed. What the rows hold is the caller's business; picking one closes the sheet.
 */
export function PaletteSheet<Item>(props: PaletteSheetProps<Item>) {
  const [query, setQuery] = createSignal("");
  // The list is always open; the combobox closes it on Tab, and typing opens it again
  const [open, setOpen] = createSignal(true);
  const shown = createMemo(() => props.rows(query()));
  const options = createMemo<Row<Item>[]>(() =>
    shown().map((item, index) => ({ key: String(index), item })),
  );
  let input: HTMLInputElement | undefined;

  // An input method commits its candidate with Enter, which must not run the row under it
  onMount(() => {
    input?.focus();
    // The key events are delegated at the document, so stopping the propagation here keeps the
    // combobox from seeing a commit Enter at all
    input?.addEventListener(
      "keydown",
      (event) => {
        if (event.isComposing) event.stopPropagation();
      },
      true,
    );
  });

  const pick = (row: Row<Item> | undefined) => {
    if (row === undefined) return;
    props.onPick(row.item);
    props.onClose();
  };

  return (
    <Sheet title={props.title} onClose={props.onClose}>
      <KobalteCombobox<Row<Item>>
        open={open()}
        onOpenChange={setOpen}
        options={options()}
        optionValue={(row) => row.key}
        optionTextValue={() => ""}
        // Picking closes the sheet, and the query is what the field keeps until it does
        optionLabel={() => query()}
        defaultFilter={() => true}
        allowsEmptyCollection
        closeOnSelection={false}
        triggerMode="input"
        onInputChange={setQuery}
        onChange={(selected) => pick(selectedRow(selected))}
        itemComponent={(itemProps) => (
          <KobalteCombobox.Item
            item={itemProps.item}
            class="flex w-full cursor-pointer items-center gap-3 rounded-md py-1.5 pe-2.5 text-start text-xs text-muted-foreground outline-none transition-colors data-highlighted:bg-selected data-highlighted:font-medium data-highlighted:text-foreground"
          >
            {props.children(itemProps.item.rawValue.item)}
          </KobalteCombobox.Item>
        )}
      >
        <KobalteCombobox.Input
          as={Input}
          ref={(element) => (input = element)}
          placeholder={props.placeholder}
          aria-label={props.title}
        />
        <KobalteCombobox.Listbox
          as={(listProps: ScrollViewProps) => (
            <ScrollView
              as="ul"
              {...listProps}
              aria-label={props.title}
              class="flex max-h-80 min-h-0 flex-col gap-0.5"
            />
          )}
        />
        <FocusFirstRow />
        <ShowFocusedRow />
      </KobalteCombobox>
      <Show when={shown().length === 0 && props.emptyMessage !== undefined}>
        <p role="status" class="px-2 py-1.5 text-muted-foreground">
          {props.emptyMessage}
        </p>
      </Show>
      <Show when={props.hint}>
        {(hint) => <p class="px-2 pb-1 text-2xs text-muted-foreground">{hint()}</p>}
      </Show>
    </Sheet>
  );
}
