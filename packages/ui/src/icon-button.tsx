import { omit } from "solid-js";
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
  const rest = omit(props, "label", "variant", "size", "class", "children");
  const variant = () => props.variant ?? "ghost";
  const size = () => props.size ?? "icon-xs";

  return (
    <Button
      {...rest}
      variant={variant()}
      size={size()}
      title={props.label}
      aria-label={props.label}
      class={props.class}
    >
      {props.children}
    </Button>
  );
}
