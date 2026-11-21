import type { JSX } from "@solidjs/web";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { omit } from "solid-js";

const calloutVariants = cva(
  "rounded-lg border-hairline border-solid p-3 text-xs [&_svg]:size-4 [&_svg]:shrink-0",
  {
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
  },
);

export type CalloutProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "class"> &
  VariantProps<typeof calloutVariants> & { class?: string | undefined };

/** A tinted panel for a status message, such as the state of an update. */
export function Callout(props: CalloutProps) {
  const rest = omit(props, "class", "variant");

  return (
    <div
      data-slot="callout"
      class={cn(calloutVariants({ variant: props.variant }), props.class)}
      {...rest}
    />
  );
}
