import { ChevronRight } from "lucide-solid";
import { createMemo, createSelector, Index, Show, type Component } from "solid-js";
import { ListItem, rowIndent } from "@/components/ui";
import { headingKey, type OutlineHeading } from "@/features/editor/outline-heading";
import { t } from "@/i18n";
import { css, cx } from "@/styled-system/css";

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

const list = css({ padding: "2", spaceY: "0.5" });
const empty = css({
  height: "32",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textStyle: "2xs",
  color: "muted.foreground",
});
const rowStyle = css({ display: "flex", alignItems: "center" });
const spacer = css({ width: "4", height: "4", flexShrink: 0 });
const toggle = css({
  display: "grid",
  width: "4",
  height: "4",
  flexShrink: 0,
  placeItems: "center",
  borderRadius: "sm",
  color: "tertiary",
  outlineStyle: "none",
  layerStyle: "interactive",
  _hover: { color: "foreground" },
  _focusVisible: { boxShadow: "focus" },
});
const chevron = css({
  width: "3",
  height: "3",
  transitionProperty: "transform, rotate, scale",
  transitionDuration: "base",
  transitionTimingFunction: "outExpo",
  _rtl: { scale: "-1 1" },
});
const chevronOpen = css({ rotate: "90deg", _rtl: { rotate: "-90deg" } });
const item = css({ minWidth: 0, flex: "1" });
const topLevelItem = css({ fontWeight: "medium" });
const untitled = css({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontStyle: "italic",
  color: "tertiary",
});
const title = css({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

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
  const isActive = createSelector(() => props.activeIndex);

  return (
    <div class={list}>
      <Show
        when={props.headings.length > 0}
        fallback={<div class={empty}>{t().sidebar.noHeadings}</div>}
      >
        {/* Rows are positional: a heading inserted above or a folded section shifts every row
            below it. Index keeps the DOM and updates the row in place instead of rebuilding the
            whole list, while the heading itself stays the source of every label and action. */}
        <Index each={rows()}>
          {(row) => (
            <div
              data-folded={row().hidden ? "" : undefined}
              inert={row().hidden}
              aria-hidden={row().hidden ? "true" : undefined}
              class={cx("outline-row", rowStyle)}
            >
              <Show when={row().hasChildren} fallback={<span aria-hidden="true" class={spacer} />}>
                <button
                  type="button"
                  aria-expanded={!folded(row().heading)}
                  aria-label={
                    folded(row().heading) ? t().sidebar.expandSection : t().sidebar.collapseSection
                  }
                  onClick={() => props.onToggleCollapsed(row().heading)}
                  class={toggle}
                >
                  <ChevronRight
                    class={folded(row().heading) ? chevron : cx(chevron, chevronOpen)}
                  />
                </button>
              </Show>
              <ListItem
                dir="auto"
                active={isActive(row().index)}
                aria-current={isActive(row().index) ? "location" : undefined}
                onClick={() => props.onSelectHeading(row().heading)}
                style={rowIndent(row().heading.level - 1, 10)}
                class={cx(item, row().heading.level === 1 && topLevelItem)}
                title={row().heading.text.trim() || t().sidebar.untitled}
              >
                <Show
                  when={row().heading.text.trim()}
                  fallback={<span class={untitled}>{t().sidebar.untitled}</span>}
                >
                  <span class={title}>{row().heading.text}</span>
                </Show>
              </ListItem>
            </div>
          )}
        </Index>
      </Show>
    </div>
  );
};
