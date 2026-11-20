import type { JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { css, cx } from "./styled-system/css";

const kbd = css({
  fontFamily: "mono",
  textStyle: "2xs",
  fontWeight: "normal",
  letterSpacing: "tight",
  opacity: 0.7,
});

/** A keyboard shortcut shown next to an action; it takes the color of its surroundings. */
export function Kbd(props: Omit<JSX.HTMLAttributes<HTMLElement>, "class"> & { class?: string | undefined }) {
  const rest = omit(props, "class");

  return <kbd data-slot="kbd" class={cx(kbd, props.class)} {...rest} />;
}
