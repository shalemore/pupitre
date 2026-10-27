import { cn } from "cn";
import { ChevronRight } from "lucide-solid";
import { createMemo, createSelector, Index, Show, type Component } from "solid-js";
import { ListItem, rowIndent } from "@/components/ui";
import { headingKey, type OutlineHeading } from "@/features/editor/outline-heading";
import { t } from "@/i18n";

interface OutlineListProps {
  headings: readonly OutlineHeading[];
  /** Index in headings of the section the cursor is in; -1 means the cursor is before the first heading. */
  activeIndex: number;
  /** Keys (see headingKey) of the headings whose own section is collapsed. */
  collapsed: ReadonlySet<string>;
  onToggleCollapsed: (heading: OutlineHeading) => void;
  onSelectHeading: (heading: OutlineHeading) => void;
}

interface OutlineRow {
  heading: OutlineHeading;
  /** Index in headings, which the active row is told apart by. */
  index: number;
  /** Whether headings of its own follow it, which is what the chevron hides. */
  hasChildren: boolean;
}

export const OutlineList: Component<OutlineListProps> = (props) => {
  // The rows to show, with the ones a folded section hides left out. A heading belongs to the last
  // one before it that is shallower, so the sections still open above it are the ones still on the
  // stack once the deeper ones have gone.
  const rows = createMemo(() => {
    const open: { level: number; folded: boolean }[] = [];
    const shown: OutlineRow[] = [];
    props.headings.forEach((heading, index) => {
      let enclosing = open.at(-1);
      while (enclosing !== undefined && enclosing.level >= heading.level) {
        open.pop();
        enclosing = open.at(-1);
      }
      const hasChildren = (props.headings[index + 1]?.level ?? 0) > heading.level;
      const hidden = open.some((section) => section.folded);
      if (!hidden) shown.push({ heading, index, hasChildren });
      open.push({ level: heading.level, folded: props.collapsed.has(headingKey(heading)) });
    });
    return shown;
  });

  const folded = (heading: OutlineHeading) => props.collapsed.has(headingKey(heading));
  const isActive = createSelector(() => props.activeIndex);

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
        {/* Rows are positional: a heading inserted above or a folded section shifts every row
            below it. Index keeps the DOM and updates the row in place instead of rebuilding the
            whole list, while the heading itself stays the source of every label and action. */}
        <Index each={rows()}>
          {(row) => (
            <div class="flex items-center">
              <Show
                when={row().hasChildren}
                fallback={<span aria-hidden="true" class="size-4 shrink-0" />}
              >
                <button
                  type="button"
                  aria-expanded={!folded(row().heading)}
                  aria-label={
                    folded(row().heading) ? t().sidebar.expandSection : t().sidebar.collapseSection
                  }
                  onClick={() => props.onToggleCollapsed(row().heading)}
                  class="grid size-4 shrink-0 place-items-center rounded-sm text-tertiary outline-none transition-colors hover:text-foreground focus-visible:shadow-focus"
                >
                  <ChevronRight
                    class={cn(
                      "size-3 transition-transform duration-base rtl:-scale-x-100",
                      !folded(row().heading) && "rotate-90 rtl:-rotate-90",
                    )}
                  />
                </button>
              </Show>
              <ListItem
                dir="auto"
                active={isActive(row().index)}
                aria-current={isActive(row().index) ? "location" : undefined}
                onClick={() => props.onSelectHeading(row().heading)}
                style={rowIndent(row().heading.level - 1, 10)}
                class={cn("min-w-0 flex-1", row().heading.level === 1 && "font-medium")}
                title={row().heading.text}
              >
                <span class="min-w-0 truncate">{row().heading.text}</span>
              </ListItem>
            </div>
          )}
        </Index>
      </Show>
    </div>
  );
};
