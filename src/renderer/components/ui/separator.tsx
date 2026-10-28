import { Separator as KobalteSeparator } from "@kobalte/core/separator";
import { cn } from "cn";
import { type JSX, splitProps } from "solid-js";

export interface SeparatorProps extends JSX.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

export function Separator(props: SeparatorProps) {
  const [local, rest] = splitProps(props, ["class", "orientation"]);

  return (
    <KobalteSeparator
      orientation={local.orientation ?? "horizontal"}
      data-slot="separator"
      class={cn(
        // Kobalte draws a separator as <hr>, which the preflight gives a border in the text colour
        "shrink-0 border-0 bg-border",
        local.orientation === "vertical" ? "h-full w-px self-stretch" : "h-px w-full",
        local.class,
      )}
      {...rest}
    />
  );
}
