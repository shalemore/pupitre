import type { JSX } from "@solidjs/web";
import { Toggle } from "@ui-sdk/solid/toggle";
import { omit } from "solid-js";
import { buttonVariants, type ButtonProps } from "./button";
import { css, cx } from "./styled-system/css";

export interface ToggleIconButtonProps {
  /** Whether the button is on. */
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  /** The name of the button: it shows as its tooltip and reads as its accessible name. */
  label: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  disabled?: boolean;
  class?: string;
  children: JSX.Element;
}

const pressed = css({ "&[data-pressed]": { color: "brand" } });

/** A button that shows an icon alone and keeps the pressed state; ghost and small unless it says otherwise. */
export function ToggleIconButton(props: ToggleIconButtonProps) {
  const rest = omit(props, "label", "variant", "size", "class", "children", "onChange");

  return (
    <Toggle
      {...rest}
      onPressedChange={(next) => props.onChange(next)}
      title={props.label}
      aria-label={props.label}
      class={cx(
        buttonVariants({ variant: props.variant ?? "ghost", size: props.size ?? "icon-xs" }),
        pressed,
        props.class,
      )}
    >
      {props.children}
    </Toggle>
  );
}
