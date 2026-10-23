import { SegmentedControl as KobalteSegmentedControl } from "@kobalte/core/segmented-control";
import { cn } from "cn";
import { For, type JSX } from "solid-js";

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
 * selected one. Kobalte measures the selected item and positions the indicator.
 */
export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>) {
  return (
    <KobalteSegmentedControl
      value={props.value}
      onChange={(value) => {
        const option = props.options.find((candidate) => candidate.value === value);
        if (option) props.onChange(option.value);
      }}
      class={cn("relative flex rounded-lg bg-segmented-track p-0.5 text-xs", props.class)}
    >
      <KobalteSegmentedControl.Indicator class="absolute top-0.5 left-0.5 rounded-md bg-segmented-thumb shadow-segmented-thumb transition-[transform,width] duration-snap ease-snap" />
      <For each={props.options}>
        {(option) => (
          <KobalteSegmentedControl.Item value={option.value} class="relative flex-1">
            <KobalteSegmentedControl.ItemInput class="peer" />
            <KobalteSegmentedControl.ItemLabel class="flex h-6 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors peer-focus-visible:shadow-focus hover:text-foreground data-checked:font-medium data-checked:text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">
              {option.icon}
              <span class="truncate">{option.label}</span>
            </KobalteSegmentedControl.ItemLabel>
          </KobalteSegmentedControl.Item>
        )}
      </For>
    </KobalteSegmentedControl>
  );
}
