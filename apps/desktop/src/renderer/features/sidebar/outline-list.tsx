import { t } from "@pupitre/i18n/solid";
import { headingKey, type OutlineHeading } from "@pupitre/markdown";
import { cn, ListItem, rowIndent } from "@pupitre/ui";
import { OUTLINE_ROW } from "@pupitre/ui/styles";
import { ChevronRight } from "lucide-solid";
import { createMemo, Repeat, Show, type Component } from "solid-js";

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
  /** Whether a section above it is folded, so its row shrinks away. */
  hidden: boolean;
}

export const OutlineList: Component<OutlineListProps> = (props) => {
  // Every row stays mounted, even under a folded section, so its height can close and open with
  // the list. A heading belongs to the last one before it that is shallower, so the sections still
  // open above it are the ones still on the stack once the deeper ones have gone.
  const rows = createMemo(() => {
    const open: { level: number; folded: boolean }[] = [];
    const all: OutlineRow[] = [];
    props.headings.forEach((heading, index) => {
      let enclosing = open.at(-1);
      while (enclosing !== undefined && enclosing.level >= heading.level) {
        open.pop();
        enclosing = open.at(-1);
      }
      const hasChildren = (props.headings[index + 1]?.level ?? 0) > heading.level;
      const hidden = open.some((section) => section.folded);
      all.push({ heading, index, hasChildren, hidden });
      open.push({ level: heading.level, folded: props.collapsed.has(headingKey(heading)) });
    });
    return all;
  });

  const folded = (heading: OutlineHeading) => props.collapsed.has(headingKey(heading));
  const isActive = (index: number) => props.activeIndex === index;

  return (
    <div class="space-y-0.5 p-2">
      <Show
        when={props.headings.length > 0}
        fallback={
          <div class="flex h-32 items-center justify-center text-2xs text-muted-foreground">
            {t().sidebar.noHeadings}
          </div>
        }
      >
        {/* Rows are positional: a heading inserted above or a folded section shifts every row
            below it. Repeat keeps the DOM and updates the row in place instead of rebuilding the
            whole list, while the heading itself stays the source of every label and action. */}
        <Repeat count={rows().length}>
          {(i) => (
            <Show when={rows()[i]}>
              {(row) => (
                <div
                  data-folded={row().hidden ? "" : undefined}
                  inert={row().hidden}
                  aria-hidden={row().hidden ? "true" : undefined}
                  class={cn(OUTLINE_ROW, "flex items-center")}
                >
                  <Show
                    when={row().hasChildren}
                    fallback={<span aria-hidden="true" class="size-4 shrink-0" />}
                  >
                    <button
                      type="button"
                      aria-expanded={!folded(row().heading) ? "true" : "false"}
                      aria-label={
                        folded(row().heading)
                          ? t().sidebar.expandSection
                          : t().sidebar.collapseSection
                      }
                      onClick={() => props.onToggleCollapsed(row().heading)}
                      class="grid size-4 shrink-0 place-items-center rounded-sm text-tertiary interactive outline-none hover:text-foreground focus-visible:shadow-focus"
                    >
                      <ChevronRight
                        class={cn(
                          "size-3 transition-[transform,rotate,scale] duration-base ease-out-expo rtl:-scale-x-100",
                          !folded(row().heading) && "rotate-90 rtl:-rotate-90",
                        )}
                      />
                    </button>
                  </Show>
                  <ListItem
                    active={isActive(row().index)}
                    aria-current={isActive(row().index) ? "location" : undefined}
                    onClick={() => props.onSelectHeading(row().heading)}
                    style={rowIndent(row().heading.level - 1, 10)}
                    class={cn("min-w-0 flex-1", row().heading.level === 1 && "font-medium")}
                    title={row().heading.text.trim() || t().sidebar.untitled}
                  >
                    <Show
                      when={row().heading.text.trim()}
                      fallback={
                        <span class="min-w-0 truncate text-tertiary italic">
                          {t().sidebar.untitled}
                        </span>
                      }
                    >
                      <bdi dir="auto" class="min-w-0 truncate">
                        {row().heading.text}
                      </bdi>
                    </Show>
                  </ListItem>
                </div>
              )}
            </Show>
          )}
        </Repeat>
      </Show>
    </div>
  );
};
