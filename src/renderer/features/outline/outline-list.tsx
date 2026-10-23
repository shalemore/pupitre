import { cn } from "cn";
import { For, Show, type Component } from "solid-js";
import { ListItem } from "@/components/ui";
import { t } from "@/i18n";
import type { OutlineHeading } from "@/features/editor/document-structure";

interface OutlineListProps {
  headings: readonly OutlineHeading[];
  /** Index in headings of the section the cursor is in; -1 means the cursor is before the first heading. */
  activeIndex: number;
  onSelectHeading: (heading: OutlineHeading) => void;
}

export const OutlineList: Component<OutlineListProps> = (props) => {
  return (
    <div class="p-2 space-y-0.5">
      <Show
        when={props.headings.length > 0}
        fallback={
          <div class="h-32 flex items-center justify-center text-2xs text-muted-foreground">
            {t().sidebar.noHeadings}
          </div>
        }
      >
        <For each={props.headings}>
          {(heading, index) => (
            <ListItem
              dir="auto"
              active={props.activeIndex === index()}
              onClick={() => props.onSelectHeading(heading)}
              // Each heading level indents by 12px; the level is data, so an inline style is the only option
              style={{ "padding-inline-start": `${10 + (heading.level - 1) * 12}px` }}
              class={cn(heading.level === 1 && "font-medium")}
              title={heading.text}
            >
              <span class="min-w-0 truncate">{heading.text}</span>
            </ListItem>
          )}
        </For>
      </Show>
    </div>
  );
};
