import { Separator as KobalteSeparator } from "@kobalte/core/separator";
import { type JSX, splitProps } from "solid-js";
import { css, cx } from "@/styled-system/css";

export interface SeparatorProps extends JSX.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

// Kobalte draws a separator as <hr>, which the preflight gives a border in the text colour
const separator = css({ flexShrink: 0, borderWidth: 0, backgroundColor: "border" });
const horizontal = css({ height: "1px", width: "full" });
const vertical = css({ height: "full", width: "1px", alignSelf: "stretch" });

export function Separator(props: SeparatorProps) {
  const [local, rest] = splitProps(props, ["class", "orientation"]);
  const isVertical = () => local.orientation === "vertical";

  return (
    <KobalteSeparator
      orientation={local.orientation ?? "horizontal"}
      data-slot="separator"
      class={cx(separator, isVertical() ? vertical : horizontal, local.class)}
      {...rest}
    />
  );
}
