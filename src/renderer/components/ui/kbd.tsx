import { cn } from "cn";
import { type JSX, splitProps } from "solid-js";

/** A keyboard shortcut shown next to an action; it takes the color of its surroundings. */
export function Kbd(props: JSX.HTMLAttributes<HTMLElement>) {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <kbd
      data-slot="kbd"
      class={cn("font-mono text-2xs font-normal tracking-tight opacity-70", local.class)}
      {...rest}
    />
  );
}
