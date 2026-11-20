import {
  Select as UiSelect,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectList,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/solid/select";
import { Check, ChevronDown } from "lucide-solid";
import { For, Show } from "solid-js";
import { Badge } from "./badge";
import { optionKey, optionOfKey, type SelectOption } from "./option";
import { popupLayer } from "./popup-layer";
import { ScrollView } from "./scroll-view";
import { cva, css, cx } from "./styled-system/css";
import {
  FLOATING_PANEL,
  PANEL_COLLISION_PADDING,
  PANEL_SIDE_OFFSET,
  chevronTurn,
  listboxReset,
  truncate,
  truncateStyle,
} from "./styles";

export interface SelectProps<T extends string> {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  /** A ghost sits in a row of text, such as a footer, instead of holding a field's frame. */
  variant?: "default" | "ghost";
  class?: string;
  "aria-label"?: string;
}

// An option keeps the height of the trigger it belongs to, so the open list does not look top-heavy
const item = cva({
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "4",
    borderRadius: "sm",
    paddingInline: "2.5",
    paddingBlock: "1",
    textStyle: "xs",
    outlineStyle: "none",
    cursor: "pointer",
    _highlighted: { backgroundColor: "accent" },
  },
  variants: {
    compact: {
      true: { minHeight: "6" },
      false: { minHeight: "8" },
    },
  },
  defaultVariants: { compact: false },
});
const itemLabel = css(truncateStyle, {
  minWidth: "0",
  fontWeight: "medium",
  color: "foreground",
  ".group[data-selected] &": { color: "brand" },
});
const itemHint = css(truncateStyle, {
  textStyle: "2xs",
  color: "muted.foreground",
});
const itemText = css({ display: "flex", minWidth: "0", flexDirection: "column" });
const itemLine = css({ display: "flex", minWidth: "0", alignItems: "center", gap: "1.5" });
const check = css({ width: "3", height: "3", flexShrink: 0, color: "brand" });
const chevronIcon = cva({
  variants: {
    variant: {
      default: { width: "3.5", height: "3.5" },
      ghost: { width: "3", height: "3" },
    },
  },
  defaultVariants: { variant: "default" },
});

const trigger = cva({
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "2",
    borderRadius: "sm",
    outlineStyle: "none",
    cursor: "pointer",
    layerStyle: "interactive",
    _focusVisible: { boxShadow: "focus" },
  },
  variants: {
    variant: {
      default: {
        height: "8",
        minWidth: "36",
        borderWidth: "hairline",
        borderStyle: "solid",
        borderColor: "input",
        backgroundColor: "field",
        paddingInline: "2.5",
        textStyle: "xs",
        color: "foreground",
        _hover: { backgroundColor: "surface.0" },
        _expanded: { borderColor: "brand" },
      },
      ghost: {
        height: "6",
        paddingInline: "1.5",
        textStyle: "2xs",
        color: "tertiary",
        _hover: { backgroundColor: "accent", color: "foreground" },
        _expanded: { color: "foreground" },
      },
    },
  },
  defaultVariants: { variant: "default" },
});
const value = css(truncateStyle, {
  display: "flex",
  minWidth: "0",
  flex: "1",
  alignItems: "center",
  gap: "1.5",
});
const chevron = css({ color: "muted.foreground" }, chevronTurn);
const content = css({
  zIndex: "50",
  minWidth: "var(--anchor-width)",
  borderRadius: "sm",
  transformOrigin: "var(--transform-origin)",
  padding: "0.5",
});

/** A dropdown on top of UI SDK, which handles keyboard navigation, typeahead and ARIA. */
export function Select<T extends string>(props: SelectProps<T>) {
  const selected = () => optionOfKey(props.options, optionKey(props.value));

  return (
    <UiSelect
      value={optionKey(props.value)}
      onValueChange={(next) => {
        const option = optionOfKey(props.options, next);
        if (option) props.onChange(option.value);
      }}
    >
      <SelectTrigger
        data-slot="select-trigger"
        aria-label={props["aria-label"]}
        class={cx(trigger({ variant: props.variant }), props.class)}
      >
        <SelectValue class={value}>
          <Show when={selected()}>
            {(option) => (
              <>
                <span class={truncate} style={option().style}>
                  {option().label}
                </span>
                <Show when={option().hint}>
                  {(hint) => <span class={itemHint}>/ {hint()}</span>}
                </Show>
                <Show when={option().badge}>
                  {(badge) => (
                    <Badge variant="muted" size="sm">
                      {badge()}
                    </Badge>
                  )}
                </Show>
              </>
            )}
          </Show>
        </SelectValue>
        <span aria-hidden="true" class={chevron}>
          <ChevronDown class={chevronIcon({ variant: props.variant })} />
        </span>
      </SelectTrigger>
      <SelectContent
        data-slot="select-content"
        side="bottom"
        align="end"
        sideOffset={PANEL_SIDE_OFFSET}
        collisionPadding={PANEL_COLLISION_PADDING}
        container={popupLayer()}
        class={cx(FLOATING_PANEL, content)}
      >
        <SelectList
          render={(listProps) => (
            <ScrollView
              as="ul"
              {...listProps}
              class={listboxReset}
              style={{
                "max-height": "min(18rem, calc(var(--available-height, 30rem) - 0.5rem))",
              }}
            />
          )}
        >
          <For each={props.options}>
            {(option) => (
              <SelectItem
                data-slot="select-item"
                value={optionKey(option.value)}
                label={option.label}
                class={cx("group", item({ compact: props.variant === "ghost" }))}
              >
                <span class={itemText}>
                  <span class={itemLine}>
                    <SelectItemText class={itemLabel} style={option.style ?? {}}>
                      {option.label}
                    </SelectItemText>
                    <Show when={option.hint}>
                      {(hint) => <span class={itemHint}>/ {hint()}</span>}
                    </Show>
                    <Show when={option.badge}>
                      {(badge) => (
                        <Badge variant="muted" size="sm">
                          {badge()}
                        </Badge>
                      )}
                    </Show>
                  </span>
                  <Show when={option.description}>
                    {(description) => <span class={itemHint}>{description()}</span>}
                  </Show>
                </span>
                <SelectItemIndicator>
                  <Check class={check} />
                </SelectItemIndicator>
              </SelectItem>
            )}
          </For>
        </SelectList>
      </SelectContent>
    </UiSelect>
  );
}
