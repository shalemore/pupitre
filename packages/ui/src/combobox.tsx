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
import { optionKey, optionOfKey, type SelectOption } from "./option";
import { popupLayer } from "./popup-layer";
import { ScrollView } from "./scroll-view";
import { css, cx } from "./styled-system/css";
import {
  FLOATING_PANEL,
  PANEL_COLLISION_PADDING,
  PANEL_SIDE_OFFSET,
  chevronTurn,
  listboxReset,
  truncateStyle,
} from "./styles";

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
const icon = css(chevronTurn);
const content = css({
  zIndex: "50",
  width: "var(--anchor-width)",
  minWidth: "64",
  borderRadius: "sm",
  transformOrigin: "var(--transform-origin)",
  padding: "1",
});
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
      <div data-slot="combobox-control" class={cx(control, props.class)}>
        <ComboboxInput
          data-slot="combobox-input"
          aria-label={ariaLabel()}
          placeholder={placeholder()}
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
        sideOffset={PANEL_SIDE_OFFSET}
        collisionPadding={collisionPadding()}
        container={popupLayer()}
        class={cx(FLOATING_PANEL, content)}
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
              class={listboxReset}
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
