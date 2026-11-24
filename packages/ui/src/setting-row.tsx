import type { JSX } from "@solidjs/web";
import { cn } from "cn";
import { omit, Show } from "solid-js";

export interface SettingRowProps extends Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "title" | "class"
> {
  title: JSX.Element;
  description?: JSX.Element | undefined;
  /** Draws the row as the heading of the settings under it, with its own control on the right. */
  heading?: boolean | undefined;
  class?: string | undefined;
}

export function SettingRow(props: SettingRowProps) {
  const rest = omit(props, "class", "title", "description", "heading", "children");

  return (
    <div
      data-slot="setting-row"
      class={cn("flex min-h-14 items-center justify-between gap-6 py-3", props.class)}
      {...rest}
    >
      <div class="flex min-w-0 flex-col gap-1">
        <Show
          when={props.heading}
          fallback={<span class="text-xs font-medium text-foreground">{props.title}</span>}
        >
          <h3 class="text-sm font-semibold text-foreground">{props.title}</h3>
        </Show>
        <Show when={props.description}>
          <span class="text-2xs leading-relaxed wrap-anywhere text-muted-foreground">
            {props.description}
          </span>
        </Show>
      </div>
      <div class="flex shrink-0 items-center gap-2">{props.children}</div>
    </div>
  );
}
