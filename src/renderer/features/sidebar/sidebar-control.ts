import type { Accessor } from "solid-js";
import { settings, updateSettings } from "@/lib/settings";
import type { SidebarSide } from "@/lib/sidebar";

export interface SidebarControl {
  /** Whether the sidebar stays open when the window folds its chrome. */
  readonly open: Accessor<boolean>;
  /** The button the sidebar title shows: the pin of an immersive window, the collapse of a classic one. */
  readonly button: Accessor<"pin" | "collapse">;
  readonly setOpen: (open: boolean) => void;
}

/**
 * The pin setting means "stay open" in an immersive window; a classic window stores the opposite,
 * the collapsed state, in the same key. Reading and writing it go through here so no caller has to
 * remember which way round it is.
 *
 * `onCollapsed` lets a classic window fold the sidebar at once, rather than waiting for the pointer
 * to leave a sidebar it is still over.
 */
export function createSidebarControl(
  side: SidebarSide,
  immersive: Accessor<boolean>,
  onCollapsed: () => void,
): SidebarControl {
  const stored = () =>
    side === "start" ? settings().sidebarPinnedStart : settings().sidebarPinnedEnd;
  const store = (open: boolean) =>
    void updateSettings(
      side === "start" ? { sidebarPinnedStart: open } : { sidebarPinnedEnd: open },
    );

  return {
    open: () => (immersive() ? stored() : !stored()),
    button: () => (immersive() ? "pin" : "collapse"),
    setOpen: (open) => {
      store(immersive() ? open : !open);
      if (!immersive() && !open) onCollapsed();
    },
  };
}
