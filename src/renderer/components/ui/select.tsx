import { Select as KobalteSelect } from "@kobalte/core/select";
import { Check, ChevronDown } from "lucide-solid";
import { type JSX, Show } from "solid-js";
import { css, cx } from "@/styled-system/css";
import { Badge } from "./badge";
import { ScrollView, type ScrollViewProps } from "./scroll-view";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** A dim suffix shown after the label, such as a folder when two themes share a name. */
  hint?: string | undefined;
  /** A small tag after the label, such as where a theme was found. */
  badge?: string | undefined;
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

const item = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "4",
  borderRadius: "lg",
  paddingInline: "2.5",
  paddingBlock: "1.5",
  textStyle: "xs",
  outlineStyle: "none",
  cursor: "pointer",
  _highlighted: { backgroundColor: "accent" },
});
const itemLabel = css({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontWeight: "medium",
  color: "foreground",
  ".group[data-selected] &": { color: "brand" },
});
const itemHint = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textStyle: "2xs",
  color: "muted.foreground",
});
const itemText = css({ display: "flex", minWidth: 0, flexDirection: "column" });
const itemLine = css({ display: "flex", minWidth: 0, alignItems: "center", gap: "1.5" });
const check = css({ width: "3", height: "3", flexShrink: 0, color: "brand" });
const chevronIcon = css({ width: "3.5", height: "3.5" });
const valueLabel = css({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });

const trigger = css({
  display: "flex",
  height: "8",
  minWidth: "36",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "2",
  borderRadius: "md",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "input",
  backgroundColor: "field",
  paddingInline: "2.5",
  textStyle: "xs",
  color: "foreground",
  outlineStyle: "none",
  cursor: "pointer",
  layerStyle: "interactive",
  _hover: { backgroundColor: "surface.0" },
  _focusVisible: { boxShadow: "focus" },
  _expanded: { borderColor: "brand" },
});
const value = css({
  display: "flex",
  minWidth: 0,
  flex: "1",
  alignItems: "center",
  gap: "1.5",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
const chevron = css({
  color: "muted.foreground",
  transitionProperty: "transform",
  transitionDuration: "base",
  transitionTimingFunction: "outExpo",
  _expanded: { transform: "rotate(180deg)" },
});
const content = css({
  zIndex: "50",
  minWidth: "var(--kb-popper-anchor-width)",
  transformOrigin: "var(--kb-popper-content-transform-origin)",
  padding: "1",
});
const listbox = css({ maxHeight: "72", outlineStyle: "none" });

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
        <KobalteSelect.Item data-slot="select-item" item={itemProps.item} class={cx("group", item)}>
          <span class={itemText}>
            <span class={itemLine}>
              <KobalteSelect.ItemLabel class={itemLabel} style={itemProps.item.rawValue.style}>
                {itemProps.item.rawValue.label}
              </KobalteSelect.ItemLabel>
              <Show when={itemProps.item.rawValue.hint}>
                {(hint) => <span class={itemHint}>/ {hint()}</span>}
              </Show>
              <Show when={itemProps.item.rawValue.badge}>
                {(badge) => (
                  <Badge variant="muted" size="sm">
                    {badge()}
                  </Badge>
                )}
              </Show>
            </span>
            <Show when={itemProps.item.rawValue.description}>
              {(description) => (
                <KobalteSelect.ItemDescription class={itemHint}>
                  {description()}
                </KobalteSelect.ItemDescription>
              )}
            </Show>
          </span>
          <KobalteSelect.ItemIndicator>
            <Check class={check} />
          </KobalteSelect.ItemIndicator>
        </KobalteSelect.Item>
      )}
    >
      <KobalteSelect.Trigger
        data-slot="select-trigger"
        aria-label={props["aria-label"]}
        class={cx(trigger, props.class)}
      >
        <KobalteSelect.Value<SelectOption<T>> class={value}>
          {(state) => (
            <>
              <span class={valueLabel} style={state.selectedOption().style}>
                {state.selectedOption().label}
              </span>
              <Show when={state.selectedOption().hint}>
                {(hint) => <span class={itemHint}>/ {hint()}</span>}
              </Show>
              <Show when={state.selectedOption().badge}>
                {(badge) => (
                  <Badge variant="muted" size="sm">
                    {badge()}
                  </Badge>
                )}
              </Show>
            </>
          )}
        </KobalteSelect.Value>
        <KobalteSelect.Icon class={chevron}>
          <ChevronDown class={chevronIcon} />
        </KobalteSelect.Icon>
      </KobalteSelect.Trigger>
      <KobalteSelect.Portal>
        <KobalteSelect.Content data-slot="select-content" class={cx("floating-panel", content)}>
          <KobalteSelect.Listbox
            as={(listboxProps: ScrollViewProps) => <ScrollView as="ul" {...listboxProps} />}
            class={listbox}
          />
        </KobalteSelect.Content>
      </KobalteSelect.Portal>
    </KobalteSelect>
  );
}
