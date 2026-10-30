import { type JSX, splitProps } from "solid-js";
import { cva, cx, type RecipeVariantProps } from "@/styled-system/css";

export const buttonVariants = cva({
  base: {
    display: "inline-flex",
    flexShrink: 0,
    cursor: "pointer",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "medium",
    whiteSpace: "nowrap",
    outlineStyle: "none",
    userSelect: "none",
    _focusVisible: { boxShadow: "focus" },
    _disabled: {
      pointerEvents: "none",
      cursor: "not-allowed",
      opacity: 0.5,
    },
    // An icon keeps the size its own component gives it
    "& svg:not([class*='size-'])": { pointerEvents: "none", flexShrink: 0 },
  },
  variants: {
    variant: {
      default: {
        backgroundColor: "primary",
        color: "primary.foreground",
        _hover: { opacity: 0.9 },
      },
      brand: {
        backgroundColor: "brand",
        color: "brand.foreground",
        boxShadow: "sm",
        _hover: { backgroundColor: "brand.hover" },
      },
      outline: {
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "border",
        backgroundColor: "transparent",
        color: "foreground",
        _hover: { backgroundColor: "accent" },
      },
      secondary: {
        backgroundColor: "secondary",
        color: "secondary.foreground",
        _hover: { backgroundColor: "selected" },
      },
      ghost: {
        backgroundColor: "transparent",
        color: "muted.foreground",
        _hover: { backgroundColor: "accent", color: "foreground" },
      },
      destructive: {
        backgroundColor: "destructive/10",
        color: "destructive",
        _hover: { backgroundColor: "destructive/20" },
      },
      link: {
        color: "primary",
        textUnderlineOffset: "4px",
        _hover: { textDecoration: "underline" },
      },
    },
    size: {
      default: {
        height: "8",
        gap: "1.5",
        borderRadius: "md",
        paddingInline: "3",
        textStyle: "xs",
        "& svg:not([class*='size-'])": { width: "4", height: "4" },
      },
      xs: {
        height: "6",
        gap: "1",
        borderRadius: "md",
        paddingInline: "2",
        textStyle: "2xs",
        "& svg:not([class*='size-'])": { width: "3", height: "3" },
      },
      sm: {
        height: "7",
        gap: "1.5",
        borderRadius: "md",
        paddingInline: "2.5",
        textStyle: "xs",
        "& svg:not([class*='size-'])": { width: "3.5", height: "3.5" },
      },
      lg: {
        height: "10",
        gap: "2",
        borderRadius: "lg",
        paddingInline: "4",
        textStyle: "sm",
        "& svg:not([class*='size-'])": { width: "4", height: "4" },
      },
      icon: {
        width: "8",
        height: "8",
        borderRadius: "md",
        "& svg:not([class*='size-'])": { width: "4", height: "4" },
      },
      "icon-2xs": {
        width: "5",
        height: "5",
        borderRadius: "sm",
        "& svg:not([class*='size-'])": { width: "3", height: "3" },
      },
      "icon-xs": {
        width: "6",
        height: "6",
        borderRadius: "md",
        "& svg:not([class*='size-'])": { width: "3.5", height: "3.5" },
      },
      "icon-sm": {
        width: "7",
        height: "7",
        borderRadius: "md",
        "& svg:not([class*='size-'])": { width: "3.5", height: "3.5" },
      },
      "icon-lg": {
        width: "10",
        height: "10",
        borderRadius: "lg",
        "& svg:not([class*='size-'])": { width: "5", height: "5" },
      },
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> &
  RecipeVariantProps<typeof buttonVariants>;

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ["class", "variant", "size", "type"]);

  return (
    <button
      type={local.type ?? "button"}
      data-slot="button"
      class={cx(
        "pressable",
        buttonVariants({ variant: local.variant, size: local.size }),
        local.class,
      )}
      {...rest}
    />
  );
}
