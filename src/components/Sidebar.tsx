import { For, Show, type Component } from "solid-js";
import { Badge } from "@/components/ui";
import { t } from "@/i18n";
import type { HeadingItem } from "@/types";

interface SidebarProps {
  headings: HeadingItem[];
  currentBlockIndex: number | null;
  onSelectHeading: (blockIndex: number) => void;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  return (
    <aside class="w-64 h-full flex flex-col justify-between bg-surface-0 border-e border-border/80 select-none text-xs">
      <div class="px-3.5 py-3 border-b border-border/60 flex items-center justify-between">
        <div class="text-foreground font-medium tracking-wide">
          <span>{t().sidebar.outline}</span>
        </div>
        <Badge variant="secondary" size="sm" class="font-mono">
          {t().sidebar.sectionsCount(props.headings.length)}
        </Badge>
      </div>

      <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
        <Show
          when={props.headings.length > 0}
          fallback={
            <div class="h-32 flex flex-col items-center justify-center text-muted-foreground">
              <p class="text-[11px]">{t().sidebar.noHeadings}</p>
            </div>
          }
        >
          <For each={props.headings}>
            {(heading) => {
              const isCurrent = () => props.currentBlockIndex === heading.blockIndex;
              const indent = () => (heading.level - 1) * 12;

              return (
                <button
                  type="button"
                  onClick={() => props.onSelectHeading(heading.blockIndex)}
                  style={{
                    "padding-inline-start": `${8 + indent()}px`,
                    "text-align": "start",
                  }}
                  class={`w-full text-start py-1.5 pe-2.5 rounded-md text-[12px] transition-colors cursor-pointer block ${
                    isCurrent()
                      ? "bg-brand/10 text-brand font-medium shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                  title={heading.title}
                >
                  <span
                    dir="auto"
                    class="block truncate"
                    style={{ "text-align": "start", "unicode-bidi": "isolate" }}
                  >
                    {heading.title}
                  </span>
                </button>
              );
            }}
          </For>
        </Show>
      </div>
    </aside>
  );
};
