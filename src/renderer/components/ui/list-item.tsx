import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { type JSX, splitProps } from "solid-js";

const listItemVariants = cva(
  "flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1.5 pe-2.5 text-start text-xs transition-colors outline-none focus-visible:shadow-focus",
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

export type ListItemProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof listItemVariants>;

/**
 * A row in a sidebar list (outline, folder tree, recent files). The current row gets a neutral
 * fill rather than the accent, so the accent stays reserved for the caret, links and toggles.
 * The inline start padding is left to the caller, because tree rows indent by depth.
 */
export function ListItem(props: ListItemProps) {
  const [local, rest] = splitProps(props, ["class", "active", "tone"]);

  return (
    <button
      type="button"
      data-slot="list-item"
      class={cn(listItemVariants({ active: local.active, tone: local.tone }), local.class)}
      {...rest}
    />
  );
}
