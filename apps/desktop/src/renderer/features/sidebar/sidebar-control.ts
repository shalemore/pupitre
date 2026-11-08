import type { Accessor } from "solid-js";
import { settings, updateSetting } from "@/lib/settings";
import { sidebarState, type SidebarSide } from "@/lib/sidebar";

export interface SidebarControl {
  /** Whether the sidebar stays open when the window folds its chrome. */
  readonly open: Accessor<boolean>;
  /** The button the sidebar title shows: the pin of an immersive window, the collapse of a classic one. */
  readonly button: Accessor<"pin" | "collapse">;
  readonly setOpen: (open: boolean) => void;
}

/**
 * An immersive window stores whether a sidebar stays open as its pin; a classic one stores the
 * opposite, whether it is collapsed. Each style keeps its own key, so a window-style change does
 * not turn one into the other. Reading and writing them go through here so no caller has to
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
  const open = () => {
    const { key, closed } = sidebarState(side, immersive());
    return closed ? !settings()[key] : settings()[key];
  };
  const store = (next: boolean) => {
    const { key, closed } = sidebarState(side, immersive());
    void updateSetting(key, closed ? !next : next);
  };

  return {
    open,
    button: () => (immersive() ? "pin" : "collapse"),
    setOpen: (next) => {
      store(next);
      if (!immersive() && !next) onCollapsed();
    },
  };
}
