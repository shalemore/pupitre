import { Combobox as KobalteCombobox } from "@kobalte/core/combobox";
import { makeEventListener } from "@solid-primitives/event-listener";
import { Check, ChevronDown } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { css, cx } from "@/styled-system/css";
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

const item = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "3",
  borderRadius: "lg",
  paddingInline: "2.5",
  paddingBlock: "1.5",
  textStyle: "xs",
  outlineStyle: "none",
  cursor: "pointer",
  _highlighted: { backgroundColor: "accent" },
});
const itemLine = css({ display: "flex", alignItems: "baseline", gap: "2", minWidth: 0 });
const itemLabel = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "foreground",
  ".group[data-selected] &": { color: "brand" },
});
const itemDescription = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textStyle: "2xs",
  color: "muted.foreground",
});
const check = css({ width: "3", height: "3", flexShrink: 0, color: "brand" });
const chevronIcon = css({ width: "3.5", height: "3.5" });

const control = css({
  display: "flex",
  height: "8",
  width: "56",
  alignItems: "center",
  borderRadius: "md",
  borderWidth: "hairline",
  borderStyle: "solid",
  borderColor: "input",
  backgroundColor: "field",
  textStyle: "xs",
  layerStyle: "interactive",
  _focusWithin: { boxShadow: "focus" },
  _expanded: { borderColor: "brand" },
});
const input = css({
  height: "full",
  minWidth: 0,
  flex: "1",
  backgroundColor: "transparent",
  paddingInline: "2.5",
  color: "foreground",
  outlineStyle: "none",
  _placeholder: { color: "muted.foreground" },
});
const trigger = css({
  display: "flex",
  height: "full",
  alignItems: "center",
  paddingInline: "2",
  color: "muted.foreground",
  cursor: "pointer",
});
const icon = css({
  transitionProperty: "transform",
  transitionDuration: "base",
  transitionTimingFunction: "outExpo",
  _expanded: { transform: "rotate(180deg)" },
});
const content = css({
  zIndex: "50",
  width: "var(--kb-popper-anchor-width)",
  minWidth: "64",
  transformOrigin: "var(--kb-popper-content-transform-origin)",
  padding: "1",
});
const listbox = css({ outlineStyle: "none" });

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
  let controlElement: HTMLElement | undefined;
  let contentElement: HTMLElement | undefined;
  let inputElement: HTMLInputElement | undefined;
  let listboxElement: HTMLElement | undefined;

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (next) {
      // The list is mounted after the open state changes. The option is scrolled inside the list
      // rather than with scrollIntoView, which would scroll the panel's ancestors — the settings
      // window among them — to show a portaled option
      requestAnimationFrame(() => {
        const selectedItem = listboxElement?.querySelector<HTMLElement>("[data-selected]");
        if (!listboxElement || !selectedItem) return;
        const box = listboxElement.getBoundingClientRect();
        const rect = selectedItem.getBoundingClientRect();
        listboxElement.scrollTop += rect.top - box.top - (box.height - rect.height) / 2;
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
    inputElement?.blur();
  };

  // Capture, so a pointer down on a part of the window that cannot take the focus is seen as well
  makeEventListener(
    document,
    "pointerdown",
    (event: PointerEvent) => {
      if (!open()) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (controlElement?.contains(target) || contentElement?.contains(target)) return;
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
          class={cx("group", item)}
        >
          <span class={itemLine}>
            <KobalteCombobox.ItemLabel class={itemLabel} style={itemProps.item.rawValue.style}>
              {itemProps.item.rawValue.label}
            </KobalteCombobox.ItemLabel>
            <Show when={itemProps.item.rawValue.description}>
              {(description) => (
                <KobalteCombobox.ItemDescription class={itemDescription}>
                  {description()}
                </KobalteCombobox.ItemDescription>
              )}
            </Show>
          </span>
          <KobalteCombobox.ItemIndicator>
            <Check class={check} />
          </KobalteCombobox.ItemIndicator>
        </KobalteCombobox.Item>
      )}
    >
      <KobalteCombobox.Control
        ref={(element) => (controlElement = element)}
        data-slot="combobox-control"
        aria-label={props["aria-label"]}
        onPointerDown={() => changeOpen(true)}
        class={cx(control, props.class)}
      >
        <KobalteCombobox.Input
          ref={(element) => (inputElement = element)}
          data-slot="combobox-input"
          class={input}
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
          class={trigger}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (open()) changeOpen(false);
            else {
              changeOpen(true);
              inputElement?.focus();
            }
          }}
        >
          <KobalteCombobox.Icon class={icon}>
            <ChevronDown class={chevronIcon} />
          </KobalteCombobox.Icon>
        </KobalteCombobox.Trigger>
      </KobalteCombobox.Control>
      <KobalteCombobox.Portal>
        <KobalteCombobox.Content
          ref={(element) => (contentElement = element)}
          data-slot="combobox-content"
          onCloseAutoFocus={(event) => {
            if (!dismissedOutside) return;
            event.preventDefault();
            dismissedOutside = false;
          }}
          class={cx("floating-panel", content)}
        >
          <KobalteCombobox.Listbox
            ref={(element) => (listboxElement = element)}
            as={(listboxProps: ScrollViewProps) => <ScrollView as="ul" {...listboxProps} />}
            class={listbox}
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
