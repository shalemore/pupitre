import type { JSX } from "@solidjs/web";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { omit } from "solid-js";

const badgeVariants = cva(
  "__INTERACTIVE__ inline-flex w-fit max-w-full shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border-hairline border-solid border-transparent font-medium whitespace-nowrap select-none [&>svg]:pointer-events-none [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        muted: "bg-muted font-normal text-muted-foreground",
        outline: "border-border text-foreground",
        brand: "bg-brand text-brand-foreground",
        success: "bg-success/15 text-success",
        destructive: "bg-destructive/15 text-destructive",
      },
      size: {
        sm: "h-4.5 px-1.5 text-2xs [&>svg]:size-2.5",
        default: "h-5 px-1.5 text-xs [&>svg]:size-3",
        lg: "h-6 px-2 text-xs [&>svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type BadgeProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "class"> &
  VariantProps<typeof badgeVariants> & { class?: string | undefined };

export function Badge(props: BadgeProps) {
  const rest = omit(props, "class", "variant", "size");

  return (
    <span
      data-slot="badge"
      class={cn(badgeVariants({ variant: props.variant, size: props.size }), props.class)}
      {...rest}
    />
  );
}
