import { cn } from "cn";
import { type JSX, Show, splitProps } from "solid-js";

export interface SettingRowProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "title"> {
  title: JSX.Element | string;
  description?: string | undefined;
  icon?: JSX.Element | undefined;
  action?: JSX.Element | undefined;
}

export function SettingRow(props: SettingRowProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "title",
    "description",
    "icon",
    "action",
    "children",
  ]);

  return (
    <div
      data-slot="setting-row"
      class={cn("flex items-center justify-between gap-4 py-2.5 transition-colors", local.class)}
      {...rest}
    >
      <div class="flex items-start gap-3 min-w-0">
        <Show when={local.icon}>
          <div class="mt-0.5 text-muted-foreground shrink-0 [&_svg]:size-4">{local.icon}</div>
        </Show>
        <div class="flex flex-col gap-0.5 min-w-0">
          <span class="text-xs font-medium text-foreground select-none">{local.title}</span>
          <Show when={local.description}>
            <span class="text-[11px] text-muted-foreground select-none leading-relaxed">
              {local.description}
            </span>
          </Show>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        {local.action}
        {local.children}
      </div>
    </div>
  );
}
