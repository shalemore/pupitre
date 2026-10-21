import { cn } from "cn";
import { Check } from "lucide-solid";
import { type JSX, Show, splitProps } from "solid-js";

export interface OptionCardProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
  label?: string;
  description?: string;
  icon?: JSX.Element;
  layout?: "vertical" | "horizontal";
}

export function OptionCard(props: OptionCardProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "selected",
    "label",
    "description",
    "icon",
    "layout",
    "children",
  ]);

  const isVertical = () => local.layout === "vertical";

  return (
    <button
      type="button"
      data-slot="option-card"
      aria-pressed={local.selected}
      class={cn(
        "group relative flex cursor-pointer rounded-xl border p-3 text-xs transition-all outline-none focus-visible:shadow-focus active:scale-[0.98]",
        isVertical()
          ? "flex-col items-center justify-center gap-2 text-center"
          : "items-center justify-between gap-3 text-start",
        local.selected
          ? "border-brand bg-brand/10 font-medium text-foreground shadow-sm ring-1 ring-ring"
          : "border-border/80 bg-surface-0/60 text-muted-foreground hover:border-border hover:bg-surface-0 hover:text-foreground",
        local.class,
      )}
      {...rest}
    >
      <Show when={local.icon}>
        <div
          class={cn(
            "transition-colors",
            local.selected ? "text-brand" : "text-muted-foreground group-hover:text-foreground",
          )}
        >
          {local.icon}
        </div>
      </Show>
      <div class="flex-1 min-w-0">
        <Show when={local.label}>
          <div class={cn("font-medium", local.selected ? "text-brand" : "text-foreground")}>
            {local.label}
          </div>
        </Show>
        <Show when={local.description}>
          <div class="text-[11px] text-tertiary mt-0.5">{local.description}</div>
        </Show>
        {local.children}
      </div>
      <Show when={local.selected && !isVertical()}>
        <div class="shrink-0 rounded-full bg-brand/15 p-0.5 text-brand">
          <Check class="size-3" />
        </div>
      </Show>
    </button>
  );
}
