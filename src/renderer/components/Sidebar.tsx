import { cn } from "cn";
import { For, Show, type Component } from "solid-js";
import { t } from "@/i18n";
import type { HeadingItem } from "@/types";

interface SidebarProps {
  headings: HeadingItem[];
  currentBlockIndex: number | null;
  onSelectHeading: (blockIndex: number) => void;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  return (
    <aside class="w-64 h-full flex flex-col bg-surface-0 border-e border-border/80 select-none shrink-0 text-xs">
      <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
        <Show
          when={props.headings.length > 0}
          fallback={
            <div class="h-32 flex items-center justify-center text-[11px] text-muted-foreground">
              {t().sidebar.noHeadings}
            </div>
          }
        >
          <For each={props.headings}>
            {(heading) => (
              <button
                type="button"
                dir="auto"
                onClick={() => props.onSelectHeading(heading.blockIndex)}
                // Each heading level indents by 12px; the level is data, so an inline style is the only option
                style={{ "padding-inline-start": `${10 + (heading.level - 1) * 12}px` }}
                class={cn(
                  "w-full rounded-md py-1.5 pe-2.5 text-start transition-colors cursor-pointer block",
                  props.currentBlockIndex === heading.blockIndex
                    ? "bg-brand/10 text-brand font-medium"
                    : heading.level === 1
                      ? "text-foreground font-medium hover:bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
                title={heading.title}
              >
                <span class="block truncate">{heading.title}</span>
              </button>
            )}
          </For>
        </Show>
      </div>
    </aside>
  );
};
