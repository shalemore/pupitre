import { type JSX, splitProps } from "solid-js";
import { cva, cx, type RecipeVariantProps } from "@/styled-system/css";

const listItemVariants = cva({
  base: {
    layerStyle: "interactive",
    display: "flex",
    width: "full",
    cursor: "pointer",
    alignItems: "center",
    gap: "1.5",
    borderRadius: "md",
    paddingBlock: "1.5",
    paddingInlineEnd: "2.5",
    textAlign: "start",
    textStyle: "xs",
    outlineStyle: "none",
    _focusVisible: { boxShadow: "focus" },
  },
  variants: {
    active: {
      true: { backgroundColor: "selected", fontWeight: "medium", color: "foreground" },
      false: {
        color: "muted.foreground",
        _hover: { backgroundColor: "accent", color: "foreground" },
      },
    },
    tone: {
      default: {},
      danger: { color: "destructive", _hover: { color: "destructive" } },
    },
  },
  defaultVariants: {
    active: false,
    tone: "default",
  },
});

export type ListItemProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> &
  RecipeVariantProps<typeof listItemVariants>;

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
  const [local, rest] = splitProps(props, ["class", "active", "tone"]);

  return (
    <button
      type="button"
      data-slot="list-item"
      class={cx(listItemVariants({ active: local.active, tone: local.tone }), local.class)}
      {...rest}
    />
  );
}
