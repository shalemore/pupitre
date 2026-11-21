import type { JSX } from "@solidjs/web";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { omit } from "solid-js";

const inputVariants = cva(
  "w-full min-w-0 rounded-md border-hairline border-solid border-input bg-field text-xs transition-shadow duration-ui ease-out-expo outline-none placeholder:text-muted-foreground focus-visible:shadow-focus disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
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
export type InputProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "size" | "class"> &
  VariantProps<typeof inputVariants> & { class?: string | undefined };

export function Input(props: InputProps) {
  const rest = omit(props, "class", "type", "size");
  const type = () => props.type ?? "text";

  return (
    <input
      type={type()}
      data-slot="input"
      class={cn(inputVariants({ size: props.size }), props.class)}
      {...rest}
    />
  );
}
