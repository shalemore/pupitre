import type { JSX } from "@solidjs/web";
import {
  SegmentedControl as UiSegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/solid/segmented-control";
import { For } from "solid-js";
import { css, cx } from "./styled-system/css";
import { truncate } from "./styles";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: JSX.Element;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  class?: string;
}

const root = css({
  position: "relative",
  display: "flex",
  borderRadius: "lg",
  backgroundColor: "segmented.track",
  padding: "0.5",
  textStyle: "xs",
});
const indicator = css({
  position: "absolute",
  top: "[var(--segmented-control-indicator-top)]",
  left: "[var(--segmented-control-indicator-left)]",
  width: "[var(--segmented-control-indicator-width)]",
  height: "[var(--segmented-control-indicator-height)]",
  borderRadius: "md",
  backgroundColor: "segmented.thumb",
  boxShadow: "segmentedThumb",
  transitionProperty: "left, width",
  transitionDuration: "snap",
  transitionTimingFunction: "snap",
});
const label = css({
  layerStyle: "interactive",
  position: "relative",
  flex: "1",
  display: "flex",
  height: "6",
  cursor: "pointer",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.5",
  borderRadius: "md",
  paddingInline: "2",
  color: "muted.foreground",
  outlineStyle: "none",
  _focusVisible: { boxShadow: "focus" },
  _hover: { color: "foreground" },
  "&[data-checked]": { fontWeight: "medium", color: "foreground" },
  "& svg": { width: "3.5", height: "3.5", flexShrink: 0 },
});

/**
 * A row of mutually exclusive options on a recessed track, with a thumb that slides to the
 * selected one. UI SDK measures the selected item and positions the indicator.
 */
export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>) {
  return (
    <UiSegmentedControl
      value={props.value}
      onValueChange={(value) => {
        const option = props.options.find((candidate) => candidate.value === value);
        if (option) props.onChange(option.value);
      }}
      class={cx(root, props.class)}
    >
      <SegmentedControlIndicator class={indicator} />
      <For each={props.options}>
        {(option) => (
          <SegmentedControlItem value={option.value} class={label}>
            {option.icon}
            <span class={truncate}>{option.label}</span>
          </SegmentedControlItem>
        )}
      </For>
    </UiSegmentedControl>
  );
}
