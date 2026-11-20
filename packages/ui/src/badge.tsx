import type { JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { cva, cx, type RecipeVariantProps } from "./styled-system/css";

const badgeVariants = cva({
  base: {
    layerStyle: "interactive",
    display: "inline-flex",
    width: "fit",
    maxWidth: "full",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: "1",
    overflow: "hidden",
    borderRadius: "sm",
    borderWidth: "hairline",
    borderStyle: "solid",
    borderColor: "transparent",
    fontWeight: "medium",
    whiteSpace: "nowrap",
    userSelect: "none",
    "& > svg": { pointerEvents: "none", flexShrink: 0 },
  },
  variants: {
    variant: {
      default: { backgroundColor: "primary", color: "primary.foreground" },
      secondary: { backgroundColor: "secondary", color: "secondary.foreground" },
      muted: { backgroundColor: "muted", color: "muted.foreground", fontWeight: "normal" },
      outline: { borderColor: "border", color: "foreground" },
      brand: { backgroundColor: "brand", color: "brand.foreground" },
      success: { backgroundColor: "success/15", color: "success" },
      destructive: { backgroundColor: "destructive/15", color: "destructive" },
    },
    size: {
      sm: {
        height: "4.5",
        paddingInline: "1.5",
        textStyle: "2xs",
        "& > svg": { width: "2.5", height: "2.5" },
      },
      default: {
        height: "5",
        paddingInline: "1.5",
        textStyle: "xs",
        "& > svg": { width: "3", height: "3" },
      },
      lg: {
        height: "6",
        paddingInline: "2",
        textStyle: "xs",
        "& > svg": { width: "3.5", height: "3.5" },
      },
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export type BadgeProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "class"> &
  RecipeVariantProps<typeof badgeVariants> & { class?: string | undefined };

export function Badge(props: BadgeProps) {
  const rest = omit(props, "class", "variant", "size");

  return (
    <span
      data-slot="badge"
      class={cx(badgeVariants({ variant: props.variant, size: props.size }), props.class)}
      {...rest}
    />
  );
}
