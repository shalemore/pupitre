import { Input, ScrollView, Sheet } from "@pupitre/ui";
import type { JSX } from "@solidjs/web";
import { Command, CommandInput, CommandItem, CommandList } from "@ui-sdk/solid/command";
import { createMemo, createSignal, For, onSettled, Show } from "solid-js";

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

const paletteItem =
  "interactive flex w-full cursor-pointer items-center gap-3 rounded-md px-2.5 py-1.5 text-start text-xs text-muted-foreground outline-none data-highlighted:bg-selected data-highlighted:font-medium data-highlighted:text-foreground";

/**
 * The panel a palette is: a query field over the rows it picks, walked with the arrow keys and run
 * with Enter. It covers the window and hands the focus back to whatever held it before, whichever
 * way it was closed. What the rows hold is the caller's business; picking one closes the sheet.
 */
export function PaletteSheet<Item>(props: PaletteSheetProps<Item>) {
  const [query, setQuery] = createSignal("");
  const shown = createMemo(() => props.rows(query()));
  let input: HTMLInputElement | undefined;

  // An input method commits its candidate with Enter, which must not run the row under it
  onSettled(() => {
    input?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) event.stopPropagation();
    };
    input?.addEventListener("keydown", onKeyDown, true);
    return () => input?.removeEventListener("keydown", onKeyDown, true);
  });

  const pick = (index: number) => {
    const item = shown()[index];
    if (item === undefined) return;
    props.onPick(item);
    props.onClose();
  };

  return (
    <Sheet title={props.title} onClose={props.onClose}>
      <Command
        filter={() => true}
        query={query()}
        onQueryChange={(next) => setQuery(next)}
        onAction={(value) => pick(Number(value))}
      >
        <CommandInput
          render={(inputProps) => (
            <Input
              {...inputProps}
              ref={(element) => {
                input = element;
                const partRef = inputProps["ref"];
                if (typeof partRef === "function") partRef(element);
              }}
              dir="auto"
              placeholder={props.placeholder}
              aria-label={props.title}
            />
          )}
        />
        <CommandList
          render={(listProps) => (
            <ScrollView
              as="ul"
              {...listProps}
              aria-label={props.title}
              class="mt-2 flex max-h-80 min-h-0 flex-col gap-0.5"
            />
          )}
        >
          <For each={shown()}>
            {(row, index) => (
              <CommandItem value={String(index())} class={paletteItem}>
                {props.children(row)}
              </CommandItem>
            )}
          </For>
        </CommandList>
      </Command>
      <Show when={shown().length === 0 && props.emptyMessage !== undefined}>
        <p role="status" class="px-2.5 py-1.5 text-muted-foreground">
          {props.emptyMessage}
        </p>
      </Show>
      <Show when={props.hint}>
        {(hintText) => <p class="px-2.5 pb-1 text-2xs text-muted-foreground">{hintText()}</p>}
      </Show>
    </Sheet>
  );
}
