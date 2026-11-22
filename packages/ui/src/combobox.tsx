import {
  Combobox as UiCombobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxItemText,
  ComboboxList,
  ComboboxTrigger,
} from "@ui-sdk/solid/combobox";
import { cn } from "cn";
import { Check, ChevronDown } from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";
import { optionKey, optionOfKey, type SelectOption } from "./option";
import { popupLayer } from "./popup-layer";
import { ScrollView } from "./scroll-view";
import { FLOATING_PANEL, PANEL_COLLISION_PADDING, PANEL_SIDE_OFFSET } from "./styles";

export interface ComboboxProps {
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  class?: string;
  "aria-label"?: string;
  /** Room the popped list keeps from the window edges, such as a title bar above it. */
  overflowPadding?: number | undefined;
}

/** Whether an option matches a query that is already trimmed and lower-cased. */
function matches(option: SelectOption, query: string): boolean {
  return (
    option.label.toLocaleLowerCase().includes(query) ||
    (option.description?.toLocaleLowerCase().includes(query) ?? false)
  );
}

/**
 * A searchable dropdown for long lists such as fonts; descriptions (such as localized font names)
 * are searchable too. Opening it lists everything and brings the current value into view; the
 * list narrows only once the user types.
 */
export function Combobox(props: ComboboxProps) {
  const selected = () => optionOfKey(props.options, optionKey(props.value));
  const [query, setQuery] = createSignal("");
  const [typing, setTyping] = createSignal(false);
  const ariaLabel = () => props["aria-label"] ?? "";
  const placeholder = () => props.placeholder ?? "";
  const collisionPadding = () => props.overflowPadding ?? PANEL_COLLISION_PADDING;
  let listboxElement: HTMLElement | undefined;

  const filtered = createMemo(() => {
    const typed = typing() ? query().trim().toLocaleLowerCase() : "";
    return typed === "" ? props.options : props.options.filter((option) => matches(option, typed));
  });

  return (
    <UiCombobox
      value={optionKey(props.value)}
      onValueChange={(next) => {
        const option = optionOfKey(props.options, next);
        if (option) props.onChange(option.value);
      }}
      onQueryChange={(next, details) => {
        setQuery(next);
        setTyping(details.reason === "input-change");
      }}
      onOpenChange={(next) => {
        if (!next) {
          setTyping(false);
          return;
        }
        requestAnimationFrame(() => {
          const selectedItem = listboxElement?.querySelector<HTMLElement>("[data-selected]");
          if (!listboxElement || !selectedItem) return;
          const listBox = listboxElement.getBoundingClientRect();
          const selectedBox = selectedItem.getBoundingClientRect();
          // Centre the row in the list; scrolling it into view would move the page behind it too
          listboxElement.scrollTop +=
            selectedBox.top - listBox.top - (listBox.height - selectedBox.height) / 2;
        });
      }}
    >
      <div
        data-slot="combobox-control"
        class={cn(
          "flex h-8 w-56 items-center rounded-md border-hairline border-solid border-input bg-field text-xs interactive focus-within:shadow-focus has-data-open:border-brand",
          props.class,
        )}
      >
        <ComboboxInput
          data-slot="combobox-input"
          aria-label={ariaLabel()}
          placeholder={placeholder()}
          class="h-full min-w-0 flex-1 bg-transparent px-2.5 text-foreground outline-none placeholder:text-muted-foreground"
          onFocus={(e) => e.currentTarget.select()}
          style={selected()?.style ?? {}}
        />
        <ComboboxTrigger
          data-slot="combobox-trigger"
          class="flex h-full cursor-pointer items-center px-2 text-muted-foreground"
        >
          <span
            aria-hidden="true"
            class="transition-transform duration-base ease-out-expo [[data-open]_&]:rotate-180"
          >
            <ChevronDown class="size-3.5" />
          </span>
        </ComboboxTrigger>
      </div>
      <ComboboxContent
        data-slot="combobox-content"
        side="bottom"
        align="start"
        sideOffset={PANEL_SIDE_OFFSET}
        collisionPadding={collisionPadding()}
        container={popupLayer()}
        class={cn(
          FLOATING_PANEL,
          "z-50 w-(--anchor-width) min-w-64 origin-(--transform-origin) rounded-sm p-1",
        )}
      >
        <ComboboxList
          render={(listProps) => (
            <ScrollView
              as="ul"
              {...listProps}
              ref={(element) => {
                listboxElement = element;
                const listRef = listProps["ref"];
                if (typeof listRef === "function") listRef(element);
              }}
              class="outline-none"
              style={{
                "max-height": "min(20rem, calc(var(--available-height, 40rem) - 0.5rem))",
              }}
            />
          )}
        >
          <For each={filtered()}>
            {(option) => (
              <ComboboxItem
                data-slot="combobox-item"
                value={optionKey(option.value)}
                label={option.label}
                class="group flex cursor-pointer items-center justify-between gap-3 rounded-sm px-2.5 py-1.5 text-xs outline-none data-highlighted:bg-accent"
              >
                <span class="flex min-w-0 items-baseline gap-2">
                  <ComboboxItemText
                    class="truncate text-foreground group-data-selected:text-brand"
                    style={option.style ?? {}}
                  >
                    {option.label}
                  </ComboboxItemText>
                  <Show when={option.description}>
                    {(description) => (
                      <span class="truncate text-2xs text-muted-foreground">{description()}</span>
                    )}
                  </Show>
                </span>
                <ComboboxItemIndicator>
                  <Check class="size-3 shrink-0 text-brand" />
                </ComboboxItemIndicator>
              </ComboboxItem>
            )}
          </For>
        </ComboboxList>
      </ComboboxContent>
    </UiCombobox>
  );
}
