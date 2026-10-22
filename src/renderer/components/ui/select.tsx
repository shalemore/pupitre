import { Select as KobalteSelect } from "@kobalte/core/select";
import { cn } from "cn";
import { Check, ChevronDown } from "lucide-solid";
import { type JSX, Show } from "solid-js";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** Secondary text next to the option, such as a font's localized name; it is searchable too. */
  description?: string | undefined;
  icon?: JSX.Element;
  /** Style of the option text; the font list uses it to preview each font in itself. */
  style?: JSX.CSSProperties | undefined;
}

export interface SelectProps<T extends string> {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  class?: string;
  "aria-label"?: string;
}

/** A dropdown select built on Kobalte, which handles keyboard navigation, type-ahead and accessibility attributes. */
export function Select<T extends string>(props: SelectProps<T>) {
  const selected = () => props.options.find((option) => option.value === props.value);

  return (
    <KobalteSelect<SelectOption<T>>
      options={[...props.options]}
      optionValue="value"
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
          class="flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground outline-none cursor-pointer data-highlighted:bg-accent data-highlighted:text-foreground data-selected:text-brand data-selected:font-medium"
        >
          <span class="flex items-center gap-2 min-w-0">
            <Show when={itemProps.item.rawValue.icon}>{(icon) => icon()}</Show>
            <KobalteSelect.ItemLabel class="truncate" style={itemProps.item.rawValue.style}>
              {itemProps.item.rawValue.label}
            </KobalteSelect.ItemLabel>
          </span>
          <KobalteSelect.ItemIndicator>
            <Check class="size-3 shrink-0" />
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
            <>
              <Show when={state.selectedOption().icon}>{(icon) => icon()}</Show>
              <span class="truncate" style={state.selectedOption().style}>
                {state.selectedOption().label}
              </span>
            </>
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
