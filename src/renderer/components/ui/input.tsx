import { cn } from "cn";
import { type JSX, splitProps } from "solid-js";

export type InputProps = JSX.InputHTMLAttributes<HTMLInputElement>;

export function Input(props: InputProps) {
  const [local, rest] = splitProps(props, ["class", "type"]);

  return (
    <input
      type={local.type ?? "text"}
      data-slot="input"
      class={cn(
        "h-8 w-full min-w-0 rounded-md border border-input bg-surface-0/60 px-2.5 py-1 text-xs transition-all outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-surface-0/40 focus-visible:shadow-focus",
        local.class,
      )}
      {...rest}
    />
  );
}
