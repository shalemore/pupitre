import { splitProps } from "solid-js";
import { Button, type ButtonProps } from "./button";

export interface IconButtonProps extends Omit<
  ButtonProps,
  "title" | "aria-label" | "variant" | "size"
> {
  /** The name of the button: it shows as its tooltip and reads as its accessible name. */
  label: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}

/** A button that shows an icon alone; ghost and small unless it says otherwise. */
export function IconButton(props: IconButtonProps) {
  const [local, rest] = splitProps(props, ["label", "variant", "size", "class", "children"]);

  return (
    <Button
      {...rest}
      variant={local.variant ?? "ghost"}
      size={local.size ?? "icon-xs"}
      title={local.label}
      aria-label={local.label}
      class={local.class}
    >
      {local.children}
    </Button>
  );
}
