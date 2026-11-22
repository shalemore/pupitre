import type { JSX } from "@solidjs/web";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { omit } from "solid-js";

export const buttonVariants = cva(
  "pressable inline-flex shrink-0 cursor-pointer items-center justify-center font-medium whitespace-nowrap outline-none select-none focus-visible:shadow-focus disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg:not([class*='size-'])]:pointer-events-none [&_svg:not([class*='size-'])]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        brand: "bg-brand text-brand-foreground shadow-sm hover:bg-brand-hover",
        outline:
          "border-hairline border-solid border-border bg-transparent text-foreground hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-selected",
        ghost: "bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
        quiet:
          "bg-transparent text-tertiary opacity-50 transition-opacity duration-ui ease-out-expo hover:bg-accent hover:text-foreground hover:opacity-100 focus-visible:opacity-100 data-pressed:opacity-100",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 rounded-md px-3 text-xs [&_svg:not([class*='size-'])]:size-4",
        xs: "h-6 gap-1 rounded-md px-2 text-2xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 rounded-md px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 rounded-lg px-4 text-sm [&_svg:not([class*='size-'])]:size-4",
        icon: "size-8 rounded-md [&_svg:not([class*='size-'])]:size-4",
        "icon-2xs": "size-5 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-10 rounded-lg [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "class"> &
  VariantProps<typeof buttonVariants> & { class?: string | undefined };

export function Button(props: ButtonProps) {
  const rest = omit(props, "class", "variant", "size", "type");
  const type = () => props.type ?? "button";

  return (
    <button
      type={type()}
      data-slot="button"
      class={cn(buttonVariants({ variant: props.variant, size: props.size }), props.class)}
      {...rest}
    />
  );
}
