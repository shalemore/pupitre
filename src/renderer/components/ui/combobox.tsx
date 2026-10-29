import { Combobox as KobalteCombobox } from "@kobalte/core/combobox";
import { makeEventListener } from "@solid-primitives/event-listener";
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
  /** Room the popped list keeps from the window edges, such as a title bar above it. */
  overflowPadding?: number | undefined;
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
  // The open state is controlled so a pointer down on a non-focusable part of the window (the
  // title bar, a panel) closes the list instead of leaving the input focused and the list open
  const [open, setOpen] = createSignal(false);
  let dismissedOutside = false;
  let control: HTMLElement | undefined;
  let content: HTMLElement | undefined;
  let input: HTMLInputElement | undefined;
  let listbox: HTMLElement | undefined;

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (next) {
      // The list is mounted after the open state changes. The option is scrolled inside the list
      // rather than with scrollIntoView, which would scroll the panel's ancestors — the settings
      // window among them — to show a portaled option
      requestAnimationFrame(() => {
        const item = listbox?.querySelector<HTMLElement>("[data-selected]");
        if (!listbox || !item) return;
        const box = listbox.getBoundingClientRect();
        const rect = item.getBoundingClientRect();
        listbox.scrollTop += rect.top - box.top - (box.height - rect.height) / 2;
      });
    } else {
      setQuery("");
    }
  };

  // The open state is manual: a focus trigger would reopen the list while the input keeps the
  // focus after a pointer down on a part of the window that cannot take it, such as the title bar.
  const dismissOutside = () => {
    dismissedOutside = true;
    changeOpen(false);
    input?.blur();
  };

  // Capture, so a pointer down on a part of the window that cannot take the focus is seen as well
  makeEventListener(
    document,
    "pointerdown",
    (event: PointerEvent) => {
      if (!open()) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (control?.contains(target) || content?.contains(target)) return;
      dismissOutside();
    },
    { capture: true },
  );

  return (
    <KobalteCombobox<SelectOption>
      open={open()}
      options={[...props.options]}
      optionValue="value"
      optionLabel="label"
      optionTextValue="label"
      value={selected() ?? null}
      onChange={(option) => {
        if (option) props.onChange(option.value);
      }}
      defaultFilter={(option) => matches(option, query())}
      onOpenChange={changeOpen}
      placeholder={props.placeholder}
      triggerMode="manual"
      gutter={6}
      // The panel slides back into the window when it would overflow, keeps the padding below,
      // and hands its list the room left, so a long font list scrolls instead of leaving the window
      slide
      fitViewport
      overflowPadding={props.overflowPadding ?? 8}
      itemComponent={(itemProps) => (
        <KobalteCombobox.Item
          data-slot="combobox-item"
          item={itemProps.item}
          class="group flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs outline-none cursor-pointer data-highlighted:bg-accent"
        >
          <span class="flex items-baseline gap-2 min-w-0">
            <KobalteCombobox.ItemLabel
              class="truncate text-foreground group-data-selected:text-brand"
              style={itemProps.item.rawValue.style}
            >
              {itemProps.item.rawValue.label}
            </KobalteCombobox.ItemLabel>
            <Show when={itemProps.item.rawValue.description}>
              {(description) => (
                <KobalteCombobox.ItemDescription class="truncate text-2xs text-muted-foreground">
                  {description()}
                </KobalteCombobox.ItemDescription>
              )}
            </Show>
          </span>
          <KobalteCombobox.ItemIndicator>
            <Check class="size-3 shrink-0 text-brand" />
          </KobalteCombobox.ItemIndicator>
        </KobalteCombobox.Item>
      )}
    >
      <KobalteCombobox.Control
        ref={(element) => (control = element)}
        data-slot="combobox-control"
        aria-label={props["aria-label"]}
        onPointerDown={() => changeOpen(true)}
        class={cn(
          "flex h-8 w-56 items-center rounded-md border border-input bg-field text-xs transition-colors focus-within:shadow-focus data-expanded:border-brand",
          props.class,
        )}
      >
        <KobalteCombobox.Input
          ref={(element) => (input = element)}
          data-slot="combobox-input"
          class="h-full min-w-0 flex-1 bg-transparent px-2.5 text-foreground outline-none placeholder:text-muted-foreground"
          // Select everything on focus, so typing starts a new search instead of appending to the current font name
          onFocus={(e) => e.currentTarget.select()}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            changeOpen(true);
          }}
          style={selected()?.style}
        />
        <KobalteCombobox.Trigger
          data-slot="combobox-trigger"
          class="flex h-full items-center px-2 text-muted-foreground cursor-pointer"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (open()) changeOpen(false);
            else {
              changeOpen(true);
              input?.focus();
            }
          }}
        >
          <KobalteCombobox.Icon class="transition-transform duration-base data-expanded:rotate-180">
            <ChevronDown class="size-3.5" />
          </KobalteCombobox.Icon>
        </KobalteCombobox.Trigger>
      </KobalteCombobox.Control>
      <KobalteCombobox.Portal>
        <KobalteCombobox.Content
          ref={(element) => (content = element)}
          data-slot="combobox-content"
          onCloseAutoFocus={(event) => {
            if (!dismissedOutside) return;
            event.preventDefault();
            dismissedOutside = false;
          }}
          class="floating-panel z-50 w-(--kb-popper-anchor-width) min-w-64 origin-(--kb-popper-content-transform-origin) p-1"
        >
          <KobalteCombobox.Listbox
            ref={(element) => (listbox = element)}
            as={(listboxProps: ScrollViewProps) => <ScrollView as="ul" {...listboxProps} />}
            class="outline-none"
            style={{
              "max-height":
                "min(20rem, calc(var(--kb-popper-content-available-height, 40rem) - 0.5rem))",
            }}
          />
        </KobalteCombobox.Content>
      </KobalteCombobox.Portal>
    </KobalteCombobox>
  );
}
