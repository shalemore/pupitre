import type { JSX } from "@solidjs/web";
import { Toggle } from "@ui-sdk/solid/toggle";
import { cn } from "cn";
import { omit } from "solid-js";
import { buttonVariants, type ButtonProps } from "./button";

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

/** A button that shows an icon alone and keeps the pressed state; ghost and small unless it says otherwise. */
export function ToggleIconButton(props: ToggleIconButtonProps) {
  const rest = omit(props, "label", "variant", "size", "class", "children", "onChange");
  const variant = () => props.variant ?? "ghost";
  const size = () => props.size ?? "icon-xs";

  return (
    <Toggle
      {...rest}
      onPressedChange={props.onChange}
      title={props.label}
      aria-label={props.label}
      class={cn(
        buttonVariants({ variant: variant(), size: size() }),
        "data-[pressed]:text-brand",
        props.class,
      )}
    >
      {props.children}
    </Toggle>
  );
}
