import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { type JSX, splitProps } from "solid-js";

export const badgeVariants = cva(
  "inline-flex w-fit max-w-full shrink-0 items-center justify-center gap-1 overflow-hidden rounded-xs border border-transparent font-medium whitespace-nowrap select-none transition-colors [&>svg]:pointer-events-none [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        muted: "bg-muted text-muted-foreground font-normal",
        outline: "border-border text-foreground",
        brand: "bg-brand text-brand-foreground",
        success: "bg-success/15 text-success",
        destructive: "bg-destructive/15 text-destructive",
      },
      size: {
        sm: "h-4.5 px-1.5 text-[10px] [&>svg]:size-2.5",
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

export type BadgeProps = JSX.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge(props: BadgeProps) {
  const [local, rest] = splitProps(props, ["class", "variant", "size"]);

  return (
    <span
      data-slot="badge"
      class={cn(badgeVariants({ variant: local.variant, size: local.size }), local.class)}
      {...rest}
    />
  );
}
