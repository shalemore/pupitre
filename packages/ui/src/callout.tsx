import type { JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { cva, cx, type RecipeVariantProps } from "./styled-system/css";

const calloutVariants = cva({
  base: {
    borderRadius: "lg",
    borderWidth: "hairline",
    borderStyle: "solid",
    padding: "3",
    textStyle: "xs",
    "& svg": { width: "4", height: "4", flexShrink: 0 },
  },
  variants: {
    variant: {
      neutral: { borderColor: "border", backgroundColor: "surface.0" },
      brand: { borderColor: "brand/20", backgroundColor: "brand/10" },
      success: { borderColor: "success/20", backgroundColor: "success/10" },
      destructive: { borderColor: "destructive/20", backgroundColor: "destructive/10" },
    },
  },
  defaultVariants: {
    variant: "neutral",
  },
});

export type CalloutProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "class"> &
  RecipeVariantProps<typeof calloutVariants> & { class?: string | undefined };

/** A tinted panel for a status message, such as the state of an update. */
export function Callout(props: CalloutProps) {
  const rest = omit(props, "class", "variant");

  return (
    <div
      data-slot="callout"
      class={cx(calloutVariants({ variant: props.variant }), props.class)}
      {...rest}
    />
  );
}
