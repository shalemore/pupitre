import { TOP_MENUS, type MenuEntry, type Menus, type TopMenu } from "@shared/menu";
import { createSignal, For, onCleanup, Show, type Component } from "solid-js";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { MenuPopup } from "./menu-popup";

/** How long the pointer may be away from the bar and its menus before they fold up. */
const LEAVE_DELAY = 200;

interface OpenMenu {
  menu: TopMenu;
  entries: readonly MenuEntry[];
  /** The button the menu hangs from, in viewport coordinates. */
  anchor: DOMRect;
}

interface MenuBarProps {
  /** Told whether a menu is open, so an immersive title bar can stay unfolded under it. */
  onOpenChange: (open: boolean) => void;
}

/**
 * The menu bar Windows and Linux show in their title bar; macOS keeps the system one. The entries
 * follow the settings, the recent files and the open document, so they are asked for each time a
 * menu opens instead of being kept in sync.
 */
export const MenuBar: Component<MenuBarProps> = (props) => {
  const [open, setOpen] = createSignal<OpenMenu>();
  // Answers to earlier asks must not reopen a menu that was switched or closed in the meantime
  let asked = 0;
  // Where the focus was before a menu took it, so closing gives it back and typing continues where it did
  let previousFocus: HTMLElement | undefined;
  // Leaving the bar or a panel only folds the menu up if the pointer does not come back, which it
  // does when it crosses the gap between a button and its menu or between a menu and its submenu
  let leaveTimer: number | undefined;

  const cancelLeave = () => {
    window.clearTimeout(leaveTimer);
    leaveTimer = undefined;
  };

  const leave = () => {
    cancelLeave();
    leaveTimer = window.setTimeout(close, LEAVE_DELAY);
  };
  onCleanup(cancelLeave);

  const show = async (menu: TopMenu, button: HTMLElement) => {
    const request = ++asked;
    // A menu opened by hovering another one keeps the focus the first menu took
    previousFocus ??=
      document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const menus: Menus = await desktop.invoke("menu:items");
    if (request !== asked) return;
    setOpen({ menu, entries: menus[menu], anchor: button.getBoundingClientRect() });
    props.onOpenChange(true);
  };

  const close = () => {
    cancelLeave();
    asked++;
    setOpen(undefined);
    props.onOpenChange(false);
    previousFocus?.focus();
    previousFocus = undefined;
  };

  // Pointing at a menu opens it, and switching to the next one moves it along; a menu closes when
  // the pointer leaves it, so a click only has to open one that is not open yet
  const openMenu = (menu: TopMenu, button: HTMLElement) => {
    if (open()?.menu === menu) return;
    void show(menu, button);
  };

  return (
    <nav
      data-menu-bar
      onPointerOver={cancelLeave}
      onPointerLeave={leave}
      class="flex items-center text-xs select-none"
    >
      <For each={TOP_MENUS}>
        {(menu) => (
          <button
            type="button"
            // The bar does not take the focus from the editor, so closing the menu gives typing back
            onPointerDown={(event) => event.preventDefault()}
            onClick={(event) => openMenu(menu, event.currentTarget)}
            onPointerEnter={(event) => openMenu(menu, event.currentTarget)}
            class="px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent aria-expanded:text-foreground aria-expanded:bg-accent transition-colors cursor-pointer"
            aria-haspopup="menu"
            aria-expanded={open()?.menu === menu}
          >
            {t().menu[menu]}
          </button>
        )}
      </For>

      {/* Keyed: another menu is another panel, with its own position, highlight and submenu */}
      <Show when={open()} keyed>
        {(state) => (
          <MenuPopup
            entries={state.entries}
            anchor={state.anchor}
            onSelect={(entry) => {
              close();
              void desktop.invoke("menu:click", entry.id);
            }}
            onClose={close}
            onPointerOver={cancelLeave}
            onPointerLeave={leave}
          />
        )}
      </Show>
    </nav>
  );
};
