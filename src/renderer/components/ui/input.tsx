import { type JSX, splitProps } from "solid-js";
import { cva, cx, type RecipeVariantProps } from "@/styled-system/css";

const inputVariants = cva({
  base: {
    width: "full",
    minWidth: 0,
    borderRadius: "md",
    borderWidth: "hairline",
    borderStyle: "solid",
    borderColor: "input",
    backgroundColor: "field",
    textStyle: "xs",
    transitionProperty: "box-shadow",
    transitionDuration: "ui",
    transitionTimingFunction: "outExpo",
    outlineStyle: "none",
    _placeholder: { color: "muted.foreground" },
    _focusVisible: { boxShadow: "focus" },
    _disabled: { pointerEvents: "none", cursor: "not-allowed", opacity: 0.5 },
  },
  variants: {
    size: {
      default: { height: "8", paddingInline: "2.5" },
      sm: { height: "7", paddingInline: "2" },
    },
  },
  defaultVariants: {
    size: "default",
  },
});

// The native `size` attribute (width in characters) is never used; the name is taken by the variant
export type InputProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "size"> &
  RecipeVariantProps<typeof inputVariants>;

export function Input(props: InputProps) {
  const [local, rest] = splitProps(props, ["class", "type", "size"]);

  return (
    <input
      type={local.type ?? "text"}
      data-slot="input"
      class={cx(inputVariants({ size: local.size }), local.class)}
      {...rest}
    />
  );
}
