import { For, Show, type Component } from "solid-js";
import { t } from "@/i18n";
import type { HeadingItem } from "@/types";

interface SidebarProps {
  headings: HeadingItem[];
  currentBlockIndex: number | null;
  onSelectHeading: (blockIndex: number) => void;
  docDir?: "ltr" | "rtl" | undefined;
  zoom?: number | undefined;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  const z = () => props.zoom ?? 1.0;
  const widthPx = () => Math.round(256 * z());
  const fontSizePx = () => (12 * z()).toFixed(1);

  return (
    <aside
      style={{
        width: `${widthPx()}px`,
        "font-size": `${fontSizePx()}px`,
      }}
      class="h-full flex flex-col bg-surface-0 border-e border-border/80 select-none shrink-0"
    >
      <div
        dir={props.docDir ?? "ltr"}
        style={{
          padding: `${Math.round(8 * z())}px`,
        }}
        class="flex-1 overflow-y-auto space-y-0.5"
      >
        <Show
          when={props.headings.length > 0}
          fallback={
            <div class="h-32 flex flex-col items-center justify-center text-muted-foreground">
              <p style={{ "font-size": `${(11 * z()).toFixed(1)}px` }}>{t().sidebar.noHeadings}</p>
            </div>
          }
        >
          <For each={props.headings}>
            {(heading) => {
              const isCurrent = () => props.currentBlockIndex === heading.blockIndex;
              const indent = () => (heading.level - 1) * Math.round(12 * z());

              return (
                <button
                  type="button"
                  onClick={() => props.onSelectHeading(heading.blockIndex)}
                  style={{
                    "padding-top": `${Math.round(6 * z())}px`,
                    "padding-bottom": `${Math.round(6 * z())}px`,
                    "padding-inline-end": `${Math.round(10 * z())}px`,
                    "padding-inline-start": `${Math.round(10 * z()) + indent()}px`,
                    "text-align": "start",
                    "font-size": `${fontSizePx()}px`,
                  }}
                  class={`w-full rounded-md transition-colors cursor-pointer block ${
                    isCurrent()
                      ? "bg-brand/10 text-brand font-medium shadow-sm"
                      : heading.level === 1
                        ? "text-foreground font-medium hover:bg-accent"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                  title={heading.title}
                >
                  <span class="block truncate">{heading.title}</span>
                </button>
              );
            }}
          </For>
        </Show>
      </div>
    </aside>
  );
};
