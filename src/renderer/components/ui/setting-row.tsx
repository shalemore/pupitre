import { cn } from "cn";
import { type JSX, Show, splitProps } from "solid-js";

export interface SettingRowProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "title"> {
  title: JSX.Element;
  description?: string | undefined;
}

export function SettingRow(props: SettingRowProps) {
  const [local, rest] = splitProps(props, ["class", "title", "description", "children"]);

  return (
    <div
      data-slot="setting-row"
      class={cn("flex items-center justify-between gap-4 py-2.5", local.class)}
      {...rest}
    >
      <div class="flex min-w-0 flex-col gap-0.5">
        <span class="text-xs font-medium text-foreground">{local.title}</span>
        <Show when={local.description}>
          <span class="text-2xs leading-relaxed text-muted-foreground">{local.description}</span>
        </Show>
      </div>
      <div class="flex shrink-0 items-center gap-2">{local.children}</div>
    </div>
  );
}
