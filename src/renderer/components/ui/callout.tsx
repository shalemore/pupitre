import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { type JSX, splitProps } from "solid-js";

const calloutVariants = cva("rounded-lg border p-3 text-xs [&_svg]:size-4 [&_svg]:shrink-0", {
  variants: {
    variant: {
      neutral: "border-border bg-surface-0",
      brand: "border-brand/20 bg-brand/10",
      success: "border-success/20 bg-success/10",
      destructive: "border-destructive/20 bg-destructive/10",
    },
  },
  defaultVariants: {
    variant: "neutral",
  },
});

export type CalloutProps = JSX.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof calloutVariants>;

/** A tinted panel for a status message, such as the state of an update. */
export function Callout(props: CalloutProps) {
  const [local, rest] = splitProps(props, ["class", "variant"]);

  return (
    <div
      data-slot="callout"
      class={cn(calloutVariants({ variant: local.variant }), local.class)}
      {...rest}
    />
  );
}
