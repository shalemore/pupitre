import { ToggleButton as KobalteToggleButton } from "@kobalte/core/toggle-button";
import { cn } from "cn";
import { type JSX, splitProps } from "solid-js";
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
  const [local, rest] = splitProps(props, ["label", "variant", "size", "class", "children"]);

  return (
    <KobalteToggleButton
      {...rest}
      title={local.label}
      aria-label={local.label}
      class={cn(
        buttonVariants({ variant: local.variant ?? "ghost", size: local.size ?? "icon-xs" }),
        "data-pressed:text-brand",
        local.class,
      )}
    >
      {local.children}
    </KobalteToggleButton>
  );
}
