import { type JSX, splitProps } from "solid-js";
import { css, cx } from "@/styled-system/css";

const kbd = css({
  fontFamily: "mono",
  textStyle: "2xs",
  fontWeight: "normal",
  letterSpacing: "tight",
  opacity: 0.7,
});

/** A keyboard shortcut shown next to an action; it takes the color of its surroundings. */
export function Kbd(props: JSX.HTMLAttributes<HTMLElement>) {
  const [local, rest] = splitProps(props, ["class"]);

  return <kbd data-slot="kbd" class={cx(kbd, local.class)} {...rest} />;
}
