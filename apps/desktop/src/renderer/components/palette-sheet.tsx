import type { JSX } from "@solidjs/web";
import { Command, CommandInput, CommandItem, CommandList } from "@ui-sdk/solid/command";
import { Input, ScrollView, Sheet, type ScrollViewProps } from "@pupitre/ui";
import { createMemo, createSignal, For, onSettled, Show } from "solid-js";
import { css } from "@/styled-system/css";

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

const paletteItem = css({
  layerStyle: "interactive",
  display: "flex",
  width: "full",
  cursor: "pointer",
  alignItems: "center",
  gap: "3",
  borderRadius: "md",
  paddingBlock: "1.5",
  paddingInline: "2.5",
  textAlign: "start",
  textStyle: "xs",
  color: "muted.foreground",
  outlineStyle: "none",
  _highlighted: { backgroundColor: "selected", fontWeight: "medium", color: "foreground" },
});
const list = css({
  display: "flex",
  maxHeight: "80",
  minHeight: "0",
  flexDirection: "column",
  gap: "0.5",
  marginBlockStart: "2",
});
const empty = css({ paddingInline: "2.5", paddingBlock: "1.5", color: "muted.foreground" });
const hint = css({
  paddingInline: "2.5",
  paddingBlockEnd: "1",
  textStyle: "2xs",
  color: "muted.foreground",
});

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
              {...(listProps as ScrollViewProps)}
              aria-label={props.title}
              class={list}
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
        <p role="status" class={empty}>
          {props.emptyMessage}
        </p>
      </Show>
      <Show when={props.hint}>{(hintText) => <p class={hint}>{hintText()}</p>}</Show>
    </Sheet>
  );
}
