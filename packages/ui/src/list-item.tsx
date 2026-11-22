import type { JSX } from "@solidjs/web";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { omit } from "solid-js";

const listItemVariants = cva(
  "__INTERACTIVE__ flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1.5 pe-2.5 text-start text-xs outline-none focus-visible:shadow-focus",
  {
    variants: {
      active: {
        true: "bg-selected font-medium text-foreground",
        false: "text-muted-foreground hover:bg-accent hover:text-foreground",
      },
      tone: {
        default: "",
        danger: "text-destructive hover:text-destructive",
      },
    },
    defaultVariants: {
      active: false,
      tone: "default",
    },
  },
);

export type ListItemProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "class"> &
  VariantProps<typeof listItemVariants> & { class?: string | undefined };

/** How far one level of nesting moves a row past `base`, the start padding a row without nesting has. */
export function rowIndent(depth: number, base: number) {
  return { "padding-inline-start": `${base + depth * 12}px` };
}

/**
 * A row in a sidebar list (outline, folder tree, recent files). The current row gets a neutral
 * fill rather than the accent, so the accent stays reserved for the caret, links and toggles.
 * The inline start padding is left to the caller, because tree rows indent by depth.
 */
export function ListItem(props: ListItemProps) {
  const rest = omit(props, "class", "active", "tone");

  return (
    <button
      type="button"
      data-slot="list-item"
      class={cn(listItemVariants({ active: props.active, tone: props.tone }), props.class)}
      {...rest}
    />
  );
}
