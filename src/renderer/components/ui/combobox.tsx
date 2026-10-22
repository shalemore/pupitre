import { Combobox as KobalteCombobox } from "@kobalte/core/combobox";
import { cn } from "cn";
import { Check, ChevronDown } from "lucide-solid";
import { Show } from "solid-js";
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

/** A searchable dropdown for long lists such as fonts; descriptions (such as localized font names) are searchable too. */
export function Combobox(props: ComboboxProps) {
  const selected = () => props.options.find((option) => option.value === props.value);

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
      defaultFilter={matches}
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
          <KobalteCombobox.Listbox class="max-h-80 overflow-y-auto outline-none" />
        </KobalteCombobox.Content>
      </KobalteCombobox.Portal>
    </KobalteCombobox>
  );
}
