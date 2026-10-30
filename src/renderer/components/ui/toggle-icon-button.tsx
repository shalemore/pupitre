import { ToggleButton as KobalteToggleButton } from "@kobalte/core/toggle-button";
import { type JSX, splitProps } from "solid-js";
import { css, cx } from "@/styled-system/css";
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

const pressed = css({ "&[data-pressed]": { color: "brand" } });

/** A button that shows an icon alone and keeps the pressed state; ghost and small unless it says otherwise. */
export function ToggleIconButton(props: ToggleIconButtonProps) {
  const [local, rest] = splitProps(props, ["label", "variant", "size", "class", "children"]);

  return (
    <KobalteToggleButton
      {...rest}
      title={local.label}
      aria-label={local.label}
      class={cx(
        buttonVariants({ variant: local.variant ?? "ghost", size: local.size ?? "icon-xs" }),
        pressed,
        local.class,
      )}
    >
      {local.children}
    </KobalteToggleButton>
  );
}
