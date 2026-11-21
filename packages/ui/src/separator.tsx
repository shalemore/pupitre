import { Separator as UiSeparator } from "@ui-sdk/solid/separator";
import { cn } from "cn";

export interface SeparatorProps {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
  class?: string | undefined;
}

export function Separator(props: SeparatorProps) {
  const orientation = () => props.orientation ?? "horizontal";
  const isVertical = () => orientation() === "vertical";

  return (
    <UiSeparator
      data-slot="separator"
      orientation={orientation()}
      decorative={props.decorative ?? false}
      class={cn(
        "shrink-0 border-0 bg-border",
        isVertical() ? "h-full w-px self-stretch" : "h-px w-full",
        props.class,
      )}
    />
  );
}
