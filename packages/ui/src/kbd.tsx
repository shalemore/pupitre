import type { JSX } from "@solidjs/web";
import { cn } from "cn";
import { omit } from "solid-js";

/** A keyboard shortcut shown next to an action; it takes the color of its surroundings. */
export function Kbd(
  props: Omit<JSX.HTMLAttributes<HTMLElement>, "class"> & { class?: string | undefined },
) {
  const rest = omit(props, "class");

  return (
    <kbd
      data-slot="kbd"
      class={cn("font-mono text-2xs font-normal tracking-tight opacity-70", props.class)}
      {...rest}
    />
  );
}
