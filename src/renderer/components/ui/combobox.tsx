import { Combobox as KobalteCombobox } from "@kobalte/core/combobox";
import { cn } from "cn";
import { Check, ChevronDown } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { ScrollView, type ScrollViewProps } from "./scroll-view";
import type { SelectOption } from "./select";

export interface ComboboxProps {
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  class?: string;
  "aria-label"?: string;
}

function matches(option: SelectOption, input: string): boolean {
  const query = input.trim().toLocaleLowerCase();
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
  const selected = () => props.options.find((option) => option.value === props.value);
  // What the user has typed since opening. The input shows the current value's label, which must not filter the list, or the list would only ever hold the current value
  const [query, setQuery] = createSignal("");
  let listbox: HTMLElement | undefined;

  return (
    <KobalteCombobox<SelectOption>
      options={[...props.options]}
      optionValue="value"
      optionLabel="label"
      optionTextValue="label"
      value={selected() ?? null}
      onChange={(option) => {
        if (option) props.onChange(option.value);
      }}
      defaultFilter={(option) => matches(option, query())}
      onOpenChange={(open) => {
        if (open) {
          // The list is mounted after the open state changes
          requestAnimationFrame(() =>
            listbox?.querySelector("[data-selected]")?.scrollIntoView({ block: "center" }),
          );
        } else {
          setQuery("");
        }
      }}
      placeholder={props.placeholder}
      triggerMode="focus"
      gutter={6}
      itemComponent={(itemProps) => (
        <KobalteCombobox.Item
          item={itemProps.item}
          class="flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground outline-none cursor-pointer data-highlighted:bg-accent data-highlighted:text-foreground data-selected:text-brand"
        >
          <span class="flex items-baseline gap-2 min-w-0">
            <KobalteCombobox.ItemLabel
              class="truncate text-sm"
              style={itemProps.item.rawValue.style}
            >
              {itemProps.item.rawValue.label}
            </KobalteCombobox.ItemLabel>
            <Show when={itemProps.item.rawValue.description}>
              {(description) => (
                <KobalteCombobox.ItemDescription class="truncate text-[11px] text-tertiary">
                  {description()}
                </KobalteCombobox.ItemDescription>
              )}
            </Show>
          </span>
          <KobalteCombobox.ItemIndicator>
            <Check class="size-3 shrink-0" />
          </KobalteCombobox.ItemIndicator>
        </KobalteCombobox.Item>
      )}
    >
      <KobalteCombobox.Control
        aria-label={props["aria-label"]}
        class={cn(
          "flex h-8 w-56 items-center rounded-md border border-input bg-surface-0/60 text-xs transition-colors focus-within:shadow-focus data-expanded:border-brand",
          props.class,
        )}
      >
        <KobalteCombobox.Input
          class="h-full min-w-0 flex-1 bg-transparent px-2.5 text-foreground outline-none placeholder:text-muted-foreground"
          // Select everything on focus, so typing starts a new search instead of appending to the current font name
          onFocus={(e) => e.currentTarget.select()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          style={selected()?.style}
        />
        <KobalteCombobox.Trigger class="flex h-full items-center px-2 text-muted-foreground cursor-pointer">
          <KobalteCombobox.Icon class="transition-transform data-expanded:rotate-180">
            <ChevronDown class="size-3.5" />
          </KobalteCombobox.Icon>
        </KobalteCombobox.Trigger>
      </KobalteCombobox.Control>
      <KobalteCombobox.Portal>
        <KobalteCombobox.Content class="z-50 w-(--kb-popper-anchor-width) min-w-64 rounded-xl border border-border/80 bg-surface-2 p-1 shadow-float animate-in fade-in-0 zoom-in-95 duration-(--duration-ui)">
          <KobalteCombobox.Listbox
            ref={(element) => (listbox = element)}
            as={(listboxProps: ScrollViewProps) => <ScrollView as="ul" {...listboxProps} />}
            class="max-h-80 outline-none"
          />
        </KobalteCombobox.Content>
      </KobalteCombobox.Portal>
    </KobalteCombobox>
  );
}
