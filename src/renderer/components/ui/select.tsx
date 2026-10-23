import { Select as KobalteSelect } from "@kobalte/core/select";
import { cn } from "cn";
import { Check, ChevronDown } from "lucide-solid";
import { type JSX, Show } from "solid-js";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** Secondary text shown with the label, such as a localized font name; also searchable. */
  description?: string | undefined;
  /** Style of the label; the font list uses it to preview each font in its own face. */
  style?: JSX.CSSProperties | undefined;
}

export interface SelectProps<T extends string> {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  class?: string;
  "aria-label"?: string;
}

// Kobalte treats a selected key of "" as "nothing selected" and shows the placeholder instead of the label, so an option with an empty value needs a stand-in key
const EMPTY_VALUE_KEY = "__empty__";

/** A dropdown on top of Kobalte, which handles keyboard navigation, typeahead and ARIA. */
export function Select<T extends string>(props: SelectProps<T>) {
  const selected = () => props.options.find((option) => option.value === props.value);

  return (
    <KobalteSelect<SelectOption<T>>
      options={[...props.options]}
      optionValue={(option) => (option.value === "" ? EMPTY_VALUE_KEY : option.value)}
      optionTextValue="label"
      value={selected() ?? null}
      onChange={(option) => {
        if (option) props.onChange(option.value);
      }}
      gutter={6}
      placement="bottom-end"
      itemComponent={(itemProps) => (
        <KobalteSelect.Item
          item={itemProps.item}
          class="group flex items-center justify-between gap-4 rounded-md px-2.5 py-1.5 text-xs outline-none cursor-pointer data-highlighted:bg-accent"
        >
          <span class="flex min-w-0 flex-col">
            <KobalteSelect.ItemLabel
              class="truncate font-medium text-foreground group-data-selected:text-brand"
              style={itemProps.item.rawValue.style}
            >
              {itemProps.item.rawValue.label}
            </KobalteSelect.ItemLabel>
            <Show when={itemProps.item.rawValue.description}>
              {(description) => (
                <KobalteSelect.ItemDescription class="truncate text-[11px] text-muted-foreground">
                  {description()}
                </KobalteSelect.ItemDescription>
              )}
            </Show>
          </span>
          <KobalteSelect.ItemIndicator>
            <Check class="size-3 shrink-0 text-brand" />
          </KobalteSelect.ItemIndicator>
        </KobalteSelect.Item>
      )}
    >
      <KobalteSelect.Trigger
        aria-label={props["aria-label"]}
        class={cn(
          "flex h-8 min-w-36 items-center justify-between gap-2 rounded-md border border-input bg-surface-0/60 px-2.5 text-xs text-foreground outline-none cursor-pointer transition-colors hover:bg-surface-0 focus-visible:shadow-focus data-expanded:border-brand",
          props.class,
        )}
      >
        <KobalteSelect.Value<SelectOption<T>> class="flex items-center gap-1.5 truncate">
          {(state) => (
            <span class="truncate" style={state.selectedOption().style}>
              {state.selectedOption().label}
            </span>
          )}
        </KobalteSelect.Value>
        <KobalteSelect.Icon class="text-muted-foreground transition-transform data-expanded:rotate-180">
          <ChevronDown class="size-3.5" />
        </KobalteSelect.Icon>
      </KobalteSelect.Trigger>
      <KobalteSelect.Portal>
        <KobalteSelect.Content class="z-50 min-w-(--kb-popper-anchor-width) rounded-xl border border-border/80 bg-surface-2 p-1 shadow-float animate-in fade-in-0 zoom-in-95 duration-(--duration-ui)">
          <KobalteSelect.Listbox class="max-h-72 overflow-y-auto outline-none" />
        </KobalteSelect.Content>
      </KobalteSelect.Portal>
    </KobalteSelect>
  );
}
