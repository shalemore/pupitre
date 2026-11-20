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
import { Check, ChevronDown } from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";
import { popupLayer } from "./popup-layer";
import { ScrollView, type ScrollViewProps } from "./scroll-view";
import type { SelectOption } from "./select";
import { css, cx } from "./styled-system/css";
import { FLOATING_PANEL, truncateStyle } from "./styles";

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

const EMPTY_VALUE_KEY = "__empty__";

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
  borderRadius: "sm",
  paddingInline: "2.5",
  paddingBlock: "1.5",
  textStyle: "xs",
  outlineStyle: "none",
  cursor: "pointer",
  _highlighted: { backgroundColor: "accent" },
});
const itemLine = css({ display: "flex", alignItems: "baseline", gap: "2", minWidth: "0" });
const itemLabel = css(truncateStyle, {
  color: "foreground",
  ".group[data-selected] &": { color: "brand" },
});
const itemDescription = css(truncateStyle, {
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
  "&:has([data-open])": { borderColor: "brand" },
});
const input = css({
  height: "full",
  minWidth: "0",
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
  "[data-open] &": { transform: "rotate(180deg)" },
});
const content = css({
  zIndex: "50",
  width: "var(--anchor-width)",
  minWidth: "64",
  borderRadius: "sm",
  transformOrigin: "var(--transform-origin)",
  padding: "1",
});
const listbox = css({ outlineStyle: "none" });

/**
 * A searchable dropdown for long lists such as fonts; descriptions (such as localized font names)
 * are searchable too. Opening it lists everything and brings the current value into view; the
 * list narrows only once the user types.
 */
export function Combobox(props: ComboboxProps) {
  const keyOf = (val: string): string => (val === "" ? EMPTY_VALUE_KEY : val);
  const selected = () => props.options.find((option) => option.value === props.value);
  const [query, setQuery] = createSignal("");
  const [typing, setTyping] = createSignal(false);
  let listboxElement: HTMLElement | undefined;

  const filtered = createMemo(() => {
    const q = typing() ? query() : "";
    return q === "" ? props.options : props.options.filter((option) => matches(option, q));
  });

  return (
    <UiCombobox
      value={keyOf(props.value)}
      onValueChange={(next) => {
        if (next === null) return;
        const option = props.options.find((candidate) => keyOf(candidate.value) === next);
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
          const box = listboxElement.getBoundingClientRect();
          const rect = selectedItem.getBoundingClientRect();
          listboxElement.scrollTop += rect.top - box.top - (box.height - rect.height) / 2;
        });
      }}
    >
      <div data-slot="combobox-control" class={cx(control, props.class)}>
        <ComboboxInput
          data-slot="combobox-input"
          aria-label={props["aria-label"] ?? ""}
          placeholder={props.placeholder ?? ""}
          class={input}
          onFocus={(e) => e.currentTarget.select()}
          style={selected()?.style ?? {}}
        />
        <ComboboxTrigger data-slot="combobox-trigger" class={trigger}>
          <span aria-hidden="true" class={icon}>
            <ChevronDown class={chevronIcon} />
          </span>
        </ComboboxTrigger>
      </div>
      <ComboboxContent
        data-slot="combobox-content"
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={props.overflowPadding ?? 8}
        container={popupLayer()}
        class={cx(FLOATING_PANEL, content)}
      >
        <ComboboxList
          render={(listProps) => (
            <ScrollView
              as="ul"
              {...(listProps as ScrollViewProps)}
              ref={(element) => {
                listboxElement = element;
                const listRef = listProps["ref"];
                if (typeof listRef === "function") listRef(element);
              }}
              class={listbox}
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
                value={keyOf(option.value)}
                label={option.label}
                class={cx("group", item)}
              >
                <span class={itemLine}>
                  <ComboboxItemText class={itemLabel} style={option.style ?? {}}>
                    {option.label}
                  </ComboboxItemText>
                  <Show when={option.description}>
                    {(description) => <span class={itemDescription}>{description()}</span>}
                  </Show>
                </span>
                <ComboboxItemIndicator>
                  <Check class={check} />
                </ComboboxItemIndicator>
              </ComboboxItem>
            )}
          </For>
        </ComboboxList>
      </ComboboxContent>
    </UiCombobox>
  );
}
