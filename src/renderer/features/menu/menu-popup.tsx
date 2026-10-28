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
  /** Whether the menu is folding away; the panel stays drawn until its exit animation has played. */
  closing?: boolean | undefined;
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
  const [offset, setOffset] = createSignal({
    left: props.anchor.left,
    top: props.anchor.bottom,
    origin: "0 0",
  });
  const [active, setActive] = createSignal(-1);
  const [rightToLeft, setRightToLeft] = createSignal(false);
  const [submenu, setSubmenu] = createSignal<{
    /** The entry the submenu belongs to, so the same entry does not reopen it under the pointer. */
    index: number;
    entries: readonly MenuEntry[];
    anchor: DOMRect;
  }>();
  // Only menus that hold a checkbox need the column that shows whether it is on
  const hasChecks = () =>
    props.entries.some((entry) => entry.type === "item" && entry.checked !== undefined);

  /** Past the end of its entry, or on the other side of it when there is no room past the end. */
  const submenuLeft = (width: number, mirrored: boolean): { left: number; towardEnd: boolean } => {
    const towardEnd = mirrored
      ? props.anchor.left - PANEL_GAP - width
      : props.anchor.right + PANEL_GAP;
    const endFits = mirrored
      ? towardEnd >= VIEWPORT_MARGIN
      : towardEnd + width <= window.innerWidth - VIEWPORT_MARGIN;
    if (endFits) return { left: towardEnd, towardEnd: true };
    return {
      left: mirrored ? props.anchor.right + PANEL_GAP : props.anchor.left - PANEL_GAP - width,
      towardEnd: false,
    };
  };

  /** Under a bar button the panel lines up with the button's end edge, so it stays over the bar. */
  const barLeft = (width: number, mirrored: boolean): number =>
    mirrored ? props.anchor.right - width : props.anchor.left;

  /** Puts the panel beside its anchor and gives it the room left below, so a long menu scrolls. */
  const place = () => {
    if (!panel) return;
    // The entrance animation scales the panel, so its transformed width would put it past the edge
    const width = panel.offsetWidth;
    // A submenu opens toward the end of its line, which is the left in a right-to-left menu
    const mirrored = getComputedStyle(panel).direction === "rtl";
    setRightToLeft(mirrored);
    const nested = props.nested === true;
    // A bar menu always grows from the start of its button; a submenu from whichever side of its
    // entry it found the room on
    const { left, towardEnd } = nested
      ? submenuLeft(width, mirrored)
      : { left: barLeft(width, mirrored), towardEnd: true };
    const top = Math.max(
      VIEWPORT_MARGIN,
      nested ? props.anchor.top - SUBMENU_LIFT : props.anchor.bottom + PANEL_GAP,
    );
    // Grow from the edge that touches the anchor: the start edge, or the end one when the panel
    // opens the other way, at the top of the button or entry it hangs from
    const originX = towardEnd === mirrored ? "100%" : "0";
    const originY = nested ? Math.max(0, props.anchor.top - top) : 0;
    setOffset({
      left: Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - VIEWPORT_MARGIN - width)),
      top,
      origin: `${originX} ${originY}px`,
    });
    panel.style.maxHeight = `${Math.max(0, window.innerHeight - top - VIEWPORT_MARGIN)}px`;
  };

  onMount(() => {
    place();
    // The panel is measured again once the browser has laid it out; on mount its width can still be
    // the placeholder one, which would put a wide panel past the window edge
    requestAnimationFrame(() => place());
    panel?.focus();
  });

  // The bar owns the whole menu, so only the outermost panel watches for what closes it
  if (props.nested !== true) {
    const onOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      // A click in the bar is the bar's business: it switches or closes the menu itself
      if (target.closest("[data-menu-panel], [data-menu-bar]") !== null) return;
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
    // A submenu that opens over the pointer makes the pointer leave and enter its entry again; the
    // same entry must keep the one it opened instead of closing and reopening it on every round
    if (submenu()?.index === index) return;
    const button = panel?.querySelector(`[data-index="${index}"]`);
    if (item.submenu === undefined || !(button instanceof HTMLElement)) return;
    setSubmenu({ index, entries: item.submenu, anchor: button.getBoundingClientRect() });
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
      data-menu-panel
      data-closed={props.closing ? "" : undefined}
      role="menu"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onPointerOver={props.onPointerOver}
      onPointerLeave={props.onPointerLeave}
      style={{
        left: `${offset().left}px`,
        top: `${offset().top}px`,
        "--menu-origin": offset().origin,
      }}
      class="floating-panel floating-panel-scroll fixed z-50 flex min-w-52 flex-col p-1 text-xs text-foreground outline-none select-none"
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
                  // The entry under an open submenu keeps it; reopening it would restart its
                  // entrance animation as the pointer crosses it
                  if (active() === index() && submenu()?.index === index()) return;
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

      {/* Keyed: another entry means another submenu, with its own position and highlight. It is
          drawn outside its parent, whose own scroll area would otherwise clip it */}
      <Show when={submenu()} keyed>
        {(nested) => (
          <Portal>
            <MenuPanel
              nested
              closing={props.closing}
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
          </Portal>
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
      closing={props.closing}
      onSelect={props.onSelect}
      onClose={props.onClose}
      onPointerOver={props.onPointerOver}
      onPointerLeave={props.onPointerLeave}
    />
  </Portal>
);
