import { SegmentedControl as KobalteSegmentedControl } from "@kobalte/core/segmented-control";
import { For, type JSX } from "solid-js";
import { css, cx } from "@/styled-system/css";

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
  top: "0.5",
  left: "0.5",
  borderRadius: "md",
  backgroundColor: "segmented.thumb",
  boxShadow: "segmentedThumb",
  transitionProperty: "transform, width",
  transitionDuration: "snap",
  transitionTimingFunction: "snap",
});
const item = css({ position: "relative", flex: "1" });
const label = css({
  layerStyle: "interactive",
  display: "flex",
  height: "6",
  cursor: "pointer",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.5",
  borderRadius: "md",
  paddingInline: "2",
  color: "muted.foreground",
  _peerFocusVisible: { boxShadow: "focus" },
  _hover: { color: "foreground" },
  "&[data-checked]": { fontWeight: "medium", color: "foreground" },
  "& svg": { width: "3.5", height: "3.5", flexShrink: 0 },
});
const text = css({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });

/**
 * A row of mutually exclusive options on a recessed track, with a thumb that slides to the
 * selected one. Kobalte measures the selected item and positions the indicator.
 */
export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>) {
  return (
    <KobalteSegmentedControl
      data-slot="segmented-control"
      value={props.value}
      onChange={(value) => {
        const option = props.options.find((candidate) => candidate.value === value);
        if (option) props.onChange(option.value);
      }}
      class={cx(root, props.class)}
    >
      <KobalteSegmentedControl.Indicator data-slot="segmented-indicator" class={indicator} />
      <For each={props.options}>
        {(option) => (
          <KobalteSegmentedControl.Item value={option.value} class={item}>
            {/* `_peerFocusVisible` reads this marker class beside the label */}
            <KobalteSegmentedControl.ItemInput class="peer" />
            <KobalteSegmentedControl.ItemLabel data-slot="segmented-item" class={label}>
              {option.icon}
              <span class={text}>{option.label}</span>
            </KobalteSegmentedControl.ItemLabel>
          </KobalteSegmentedControl.Item>
        )}
      </For>
    </KobalteSegmentedControl>
  );
}
