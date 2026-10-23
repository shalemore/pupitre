import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { type JSX, splitProps } from "solid-js";

const inputVariants = cva(
  "w-full min-w-0 rounded-md border border-input bg-field text-xs transition-shadow outline-none placeholder:text-muted-foreground focus-visible:shadow-focus disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        default: "h-8 px-2.5",
        sm: "h-7 px-2",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

// The native `size` attribute (width in characters) is never used; the name is taken by the variant
export type InputProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "size"> &
  VariantProps<typeof inputVariants>;

export function Input(props: InputProps) {
  const [local, rest] = splitProps(props, ["class", "type", "size"]);

  return (
    <input
      type={local.type ?? "text"}
      data-slot="input"
      class={cn(inputVariants({ size: local.size }), local.class)}
      {...rest}
    />
  );
}
