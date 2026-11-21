import type { JSX } from "@solidjs/web";
import {
  SegmentedControl as UiSegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/solid/segmented-control";
import { cn } from "cn";
import { For } from "solid-js";
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

/**
 * A row of mutually exclusive options on a recessed track, with a thumb that slides to the
 * selected one. UI SDK measures the selected item and positions the indicator.
 */
export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>) {
  return (
    <UiSegmentedControl
      data-slot="segmented-control"
      value={props.value}
      onValueChange={(value) => {
        const option = props.options.find((candidate) => candidate.value === value);
        if (option) props.onChange(option.value);
      }}
      class={cn("relative flex rounded-lg bg-segmented-track p-0.5 text-xs", props.class)}
    >
      <SegmentedControlIndicator
        data-slot="segmented-indicator"
        class="absolute top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded-md bg-segmented-thumb shadow-segmented-thumb transition-[left,width] duration-snap ease-snap"
      />
      <For each={props.options}>
        {(option) => (
          <SegmentedControlItem
            data-slot="segmented-item"
            value={option.value}
            class="interactive relative flex h-6 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-muted-foreground outline-none hover:text-foreground focus-visible:shadow-focus data-[checked]:font-medium data-[checked]:text-foreground [&>svg]:size-3.5 [&>svg]:shrink-0"
          >
            {option.icon}
            <span class={truncate}>{option.label}</span>
          </SegmentedControlItem>
        )}
      </For>
    </UiSegmentedControl>
  );
}
