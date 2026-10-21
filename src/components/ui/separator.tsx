import { cn } from "cn";
import { type JSX, splitProps } from "solid-js";

export interface SeparatorProps extends JSX.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

export function Separator(props: SeparatorProps) {
  const [local, rest] = splitProps(props, ["class", "orientation"]);
  const isHorizontal = () => local.orientation !== "vertical";

  return (
    <div
      role="separator"
      data-slot="separator"
      aria-orientation={local.orientation ?? "horizontal"}
      class={cn(
        "shrink-0 bg-border",
        isHorizontal() ? "h-px w-full" : "h-full w-px self-stretch",
        local.class,
      )}
      {...rest}
    />
  );
}
