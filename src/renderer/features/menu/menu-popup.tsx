import { cn } from "cn";
import { Check, ChevronRight } from "lucide-solid";
import { createSignal, For, onCleanup, onMount, Show, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import type { MenuEntry } from "@shared/menu";
import { Separator } from "@/components/ui";

type MenuItemEntry = Extract<MenuEntry, { type: "item" }>;

interface PanelProps {
  entries: readonly MenuEntry[];
  /** The rect the panel is placed against, in viewport coordinates. */
  anchor: DOMRect;
  /** A submenu sits beside its entry instead of under the bar button that opened the menu. */
  nested?: boolean;
  onSelect: (entry: MenuItemEntry) => void;
  /** Closes the whole menu. */
  onClose: () => void;
  /** Closes this panel only, for a submenu that gives the focus back to its parent. */
  onCloseSelf?: () => void;
  /** Tells the bar that the pointer is over the menu, who keeps it open while it is. */
  onPointerOver?: (() => void) | undefined;
  /** Tells the bar that the pointer left the menu, which folds it up after a moment. */
  onPointerLeave?: (() => void) | undefined;
}

const PANEL_GAP = 2;
const VIEWPORT_MARGIN = 4;
/** A submenu overlaps the entry it opens from by this much, instead of hanging below it. */
const SUBMENU_LIFT = 6;

const MenuPanel: Component<PanelProps> = (props) => {
  let panel: HTMLDivElement | undefined;
  const [offset, setOffset] = createSignal({ left: props.anchor.left, top: props.anchor.bottom });
  const [active, setActive] = createSignal(-1);
  const [rightToLeft, setRightToLeft] = createSignal(false);
  const [submenu, setSubmenu] = createSignal<{
    entries: readonly MenuEntry[];
    anchor: DOMRect;
  }>();
  // Only menus that hold a checkbox need the column that shows whether it is on
  const hasChecks = () =>
    props.entries.some((entry) => entry.type === "item" && entry.checked !== undefined);

  /** Keeps the panel inside the window and flips a submenu to the other side when there is no room. */
  const place = () => {
    if (!panel) return;
    const { width, height } = panel.getBoundingClientRect();
    // A submenu opens toward the end of its line, which is the left in a right-to-left menu
    setRightToLeft(getComputedStyle(panel).direction === "rtl");
    const towardEnd = rightToLeft()
      ? props.anchor.left - PANEL_GAP - width
      : props.anchor.right + PANEL_GAP;
    const towardStart = rightToLeft()
      ? props.anchor.right + PANEL_GAP
      : props.anchor.left - PANEL_GAP - width;
    const endFits = rightToLeft()
      ? towardEnd >= VIEWPORT_MARGIN
      : towardEnd + width <= window.innerWidth - VIEWPORT_MARGIN;
    // Under a bar button the panel lines up with the button's end edge, so it stays over the bar
    const left =
      props.nested === true
        ? endFits
          ? towardEnd
          : towardStart
        : rightToLeft()
          ? props.anchor.right - width
          : props.anchor.left;
    const top =
      props.nested === true ? props.anchor.top - SUBMENU_LIFT : props.anchor.bottom + PANEL_GAP;
    setOffset({
      left: Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - VIEWPORT_MARGIN - width)),
      top: Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - VIEWPORT_MARGIN - height)),
    });
  };

  onMount(() => {
    place();
    panel?.focus();
  });

  // The bar owns the whole menu, so only the outermost panel watches for what closes it
  if (props.nested !== true) {
    const onOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      // A click in the bar is the bar's business: it switches or closes the menu itself
      if (panel?.contains(target) === true || target.closest("[data-menu-bar]") !== null) return;
      props.onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", props.onClose);
    window.addEventListener("blur", props.onClose);
    onCleanup(() => {
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", props.onClose);
      window.removeEventListener("blur", props.onClose);
    });
  }

  /** The entries the keyboard can land on, by their index in the list. */
  const reachable = () =>
    props.entries.flatMap((entry, index) =>
      entry.type === "item" && entry.enabled !== false ? [index] : [],
    );

  const openSubmenu = (index: number, item: MenuItemEntry) => {
    const button = panel?.querySelector(`[data-index="${index}"]`);
    if (item.submenu === undefined || !(button instanceof HTMLElement)) return;
    setSubmenu({ entries: item.submenu, anchor: button.getBoundingClientRect() });
  };

  const pick = (index: number, item: MenuItemEntry) => {
    if (item.enabled === false) return;
    if (item.submenu !== undefined) return openSubmenu(index, item);
    props.onSelect(item);
  };

  /** Highlights an entry and folds any open submenu away, which is what every move does. */
  const highlight = (index: number | undefined) => {
    if (index !== undefined) setActive(index);
    setSubmenu(undefined);
  };

  /** Moves the highlight by a number of entries, wrapping around the ends. */
  const move = (step: number) => {
    const indexes = reachable();
    if (indexes.length === 0) return;
    const current = indexes.indexOf(active());
    const next =
      current === -1
        ? indexes[step > 0 ? 0 : indexes.length - 1]
        : indexes[(current + step + indexes.length) % indexes.length];
    highlight(next);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const current = props.entries[active()];
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        return move(1);
      case "ArrowUp":
        event.preventDefault();
        return move(-1);
      case "Home":
        event.preventDefault();
        return highlight(reachable()[0]);
      case "End":
        event.preventDefault();
        return highlight(reachable().at(-1));
      case "Enter":
      case " ":
        if (current?.type !== "item") return;
        event.preventDefault();
        return pick(active(), current);
      case "ArrowRight":
      case "ArrowLeft": {
        event.preventDefault();
        // The arrow toward the end of the line opens a submenu, the other one backs out of it
        if ((event.key === "ArrowRight") !== rightToLeft()) {
          if (current?.type === "item") openSubmenu(active(), current);
          return;
        }
        return props.onCloseSelf?.();
      }
      default:
        return;
    }
  };

  return (
    <div
      ref={(element) => {
        panel = element;
      }}
      role="menu"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onPointerOver={props.onPointerOver}
      onPointerLeave={props.onPointerLeave}
      style={{ left: `${offset().left}px`, top: `${offset().top}px` }}
      class="fixed z-50 flex min-w-52 flex-col rounded-xl bg-popover p-1 text-xs text-foreground shadow-float outline-none select-none animate-in fade-in-0 zoom-in-95 duration-fast ease-enter"
    >
      <For each={props.entries}>
        {(entry, index) => (
          <Show
            when={entry.type === "item" ? entry : undefined}
            fallback={<Separator class="my-1 bg-border-subtle" />}
          >
            {(item) => (
              <button
                type="button"
                role="menuitem"
                data-index={index()}
                disabled={item().enabled === false}
                onPointerEnter={() => {
                  setActive(index());
                  setSubmenu(undefined);
                  if (item().submenu !== undefined) openSubmenu(index(), item());
                }}
                onClick={() => pick(index(), item())}
                class={cn(
                  "flex w-full items-center gap-6 rounded-md px-2.5 py-1.5 text-start transition-colors duration-fast",
                  item().enabled === false && "text-tertiary",
                  active() === index() && item().enabled !== false && "bg-accent text-foreground",
                )}
              >
                <span class="flex min-w-0 flex-1 items-center gap-1.5">
                  <Show when={hasChecks()}>
                    <Check
                      class={cn("size-3 shrink-0", item().checked !== true && "invisible")}
                      stroke-width={2}
                    />
                  </Show>
                  <span class="min-w-0">
                    <span class="block truncate">{item().label}</span>
                    <Show when={item().detail}>
                      <bdi dir="ltr" class="block truncate text-2xs text-tertiary">
                        {item().detail}
                      </bdi>
                    </Show>
                  </span>
                </span>
                <Show when={item().shortcut}>
                  <bdi dir="ltr" class="text-2xs text-tertiary tabular-nums">
                    {item().shortcut}
                  </bdi>
                </Show>
                <Show when={item().submenu}>
                  <ChevronRight class="size-3.5 shrink-0 text-tertiary rtl:-scale-x-100" />
                </Show>
              </button>
            )}
          </Show>
        )}
      </For>

      {/* Keyed: another entry means another submenu, with its own position and highlight */}
      <Show when={submenu()} keyed>
        {(nested) => (
          <MenuPanel
            nested
            entries={nested.entries}
            anchor={nested.anchor}
            onSelect={props.onSelect}
            onClose={props.onClose}
            onPointerOver={props.onPointerOver}
            onPointerLeave={props.onPointerLeave}
            onCloseSelf={() => {
              setSubmenu(undefined);
              panel?.focus();
            }}
          />
        )}
      </Show>
    </div>
  );
};

/** The menu under a title bar button, drawn by the window: Windows and Linux have no system menu bar to show. */
export type MenuPopupProps = Omit<PanelProps, "nested" | "onCloseSelf">;

export const MenuPopup: Component<MenuPopupProps> = (props) => (
  // A popup is drawn outside the title bar, whose height is animated and therefore clips its children
  <Portal>
    <MenuPanel
      entries={props.entries}
      anchor={props.anchor}
      onSelect={props.onSelect}
      onClose={props.onClose}
      onPointerOver={props.onPointerOver}
      onPointerLeave={props.onPointerLeave}
    />
  </Portal>
);
