import { Separator as UiSeparator } from "@ui-sdk/solid/separator";
import { css, cx } from "./styled-system/css";

export interface SeparatorProps {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
  class?: string | undefined;
}

const separator = css({ flexShrink: 0, borderWidth: "[0]", backgroundColor: "border" });
const horizontal = css({ height: "[1px]", width: "full" });
const vertical = css({ height: "full", width: "[1px]", alignSelf: "stretch" });

export function Separator(props: SeparatorProps) {
  const isVertical = () => props.orientation === "vertical";

  return (
    <UiSeparator
      data-slot="separator"
      orientation={props.orientation ?? "horizontal"}
      decorative={props.decorative ?? false}
      class={cx(separator, isVertical() ? vertical : horizontal, props.class)}
    />
  );
}
