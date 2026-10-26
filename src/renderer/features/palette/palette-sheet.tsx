import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import { Input, ListItem, ScrollView } from "@/components/ui";

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
  const [wanted, setWanted] = createSignal(0);
  let input: HTMLInputElement | undefined;
  let list: HTMLDivElement | undefined;
  let opener: HTMLElement | undefined;

  const shown = createMemo(() => props.rows(query()));
  // Clamped rather than reset, so a list that narrows under the query never points past its end
  const active = createMemo(() => Math.min(wanted(), Math.max(shown().length - 1, 0)));

  // The highlight follows the list; it has to be seen even when it moved past the port
  createEffect(() => {
    list?.querySelector(`[data-index="${active()}"]`)?.scrollIntoView({ block: "nearest" });
  });

  onMount(() => {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    input?.focus();
  });
  // Whatever closed the sheet, the focus goes back to where it was before
  onCleanup(() => {
    if (opener?.isConnected === true) opener.focus();
  });

  const move = (step: number) => {
    const count = shown().length;
    if (count === 0) return;
    setWanted((active() + step + count) % count);
  };

  const pick = (item: Item) => {
    props.onPick(item);
    props.onClose();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        return move(1);
      case "ArrowUp":
        event.preventDefault();
        return move(-1);
      case "Enter": {
        const item = shown()[active()];
        if (item === undefined) return;
        event.preventDefault();
        return pick(item);
      }
      case "Escape":
        event.preventDefault();
        return props.onClose();
      default:
        return;
    }
  };

  return (
    // Outside the window's own tree: the title bar clips its children and the sheet covers them
    <Portal>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-surface-0/60 p-4 backdrop-blur-sm animate-in fade-in-0 duration-base"
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return;
          // The press must not move the focus itself, or it lands on the page the sheet uncovers
          event.preventDefault();
          props.onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={props.title}
          onKeyDown={onKeyDown}
          class="floating-panel flex max-h-full w-full max-w-lg flex-col gap-2 p-2 text-xs animate-in fade-in-0 zoom-in-95 duration-base ease-enter"
        >
          <Input
            ref={(element) => (input = element)}
            value={query()}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setWanted(0);
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
                  aria-selected={index() === active()}
                  active={index() === active()}
                  tabIndex={-1}
                  onPointerEnter={() => setWanted(index())}
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
        </div>
      </div>
    </Portal>
  );
}
