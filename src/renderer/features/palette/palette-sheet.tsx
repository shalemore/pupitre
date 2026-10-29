import { createMemo, createSignal, createUniqueId, For, type JSX, onMount, Show } from "solid-js";
import { Input, ListItem, ScrollView, Sheet } from "@/components/ui";
import { createListNavigation } from "@/lib/list-navigation";

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

/**
 * The panel a palette is: a query field over the rows it picks, walked with the arrow keys and run
 * with Enter. It covers the window and hands the focus back to whatever held it before, whichever
 * way it was closed. What the rows hold is the caller's business; picking one closes the sheet.
 */
export function PaletteSheet<Item>(props: PaletteSheetProps<Item>) {
  // Two sheets are never open at once, but a window holding both still needs their rows told apart
  const sheetId = createUniqueId();
  const listId = `${sheetId}-list`;
  const rowId = (index: number) => `${sheetId}-row-${index}`;
  const [query, setQuery] = createSignal("");
  let input: HTMLInputElement | undefined;
  let list: HTMLDivElement | undefined;

  const shown = createMemo(() => props.rows(query()));
  const navigation = createListNavigation(
    () => shown().length,
    () => list,
  );
  const active = navigation.active;
  const isActive = navigation.isActive;

  onMount(() => input?.focus());

  const pick = (item: Item) => {
    props.onPick(item);
    props.onClose();
  };

  return (
    <Sheet
      title={props.title}
      onClose={props.onClose}
      onKeyDown={(event) =>
        navigation.onKeyDown(event, {
          pick: (index) => {
            const item = shown()[index];
            if (item !== undefined) pick(item);
          },
          close: props.onClose,
        })
      }
    >
      <Input
        ref={(element) => (input = element)}
        value={query()}
        onInput={(event) => {
          setQuery(event.currentTarget.value);
          navigation.reset();
        }}
        placeholder={props.placeholder}
        aria-label={props.title}
        role="combobox"
        aria-expanded={true}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown().length > 0 ? rowId(active()) : undefined}
      />
      <ScrollView
        ref={(element) => (list = element)}
        id={listId}
        role="listbox"
        aria-label={props.title}
        class="flex max-h-80 min-h-0 flex-col gap-0.5"
      >
        <For each={shown()}>
          {(item, index) => (
            <ListItem
              id={rowId(index())}
              data-index={index()}
              role="option"
              aria-selected={isActive(index())}
              active={isActive(index())}
              tabIndex={-1}
              onPointerEnter={() => navigation.pointAt(index())}
              onClick={() => pick(item)}
              class="gap-3"
            >
              {props.children(item)}
            </ListItem>
          )}
        </For>
      </ScrollView>
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
