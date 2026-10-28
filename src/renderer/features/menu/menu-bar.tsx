import { Menu } from "lucide-solid";
import { createSignal, For, onCleanup, Show, type Component } from "solid-js";
import { TOP_MENUS, type MenuEntry, type Menus, type TopMenu } from "@shared/menu";
import { IconButton } from "@/components/ui";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { MenuPopup } from "./menu-popup";

/** How long the pointer may be away from the bar and its menus before they fold up. */
const LEAVE_DELAY = 200;
/** Used when the stylesheet cannot say how long the panel's exit takes. */
const DEFAULT_EXIT_DURATION = 150;

/** How long the panel's exit animation runs, from the duration token the closed state asks for. */
function exitDuration(): number {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--transition-duration-ui")
    .trim();
  const length = Number.parseFloat(value);
  if (!Number.isFinite(length)) return DEFAULT_EXIT_DURATION;
  return value.endsWith("s") && !value.endsWith("ms") ? length * 1000 : length;
}

/**
 * Keeps the last panel on screen while it animates out: `shown` still renders once `closing`
 * starts, and is dropped when the exit animation has played. `open` is the state the pointer and
 * the keyboard work with, which goes away as soon as the menu closes.
 */
function createPanelLifetime<T>() {
  const [shown, setShown] = createSignal<T>();
  const [closing, setClosing] = createSignal(false);
  let exitTimer: number | undefined;

  const cancelExit = () => {
    window.clearTimeout(exitTimer);
    exitTimer = undefined;
  };
  onCleanup(cancelExit);

  return {
    shown,
    closing,
    open: () => (closing() ? undefined : shown()),
    show(state: T) {
      cancelExit();
      setClosing(false);
      // The updater form sets the value even when T itself could be a function
      setShown(() => state);
    },
    close() {
      if (shown() === undefined || closing()) return;
      setClosing(true);
      exitTimer = window.setTimeout(() => {
        exitTimer = undefined;
        setClosing(false);
        setShown(undefined);
      }, exitDuration());
    },
  };
}

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
  const panel = createPanelLifetime<OpenMenu>();
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
    panel.show({ menu, entries: menus[menu], anchor: button.getBoundingClientRect() });
    props.onOpenChange(true);
  };

  const close = () => {
    cancelLeave();
    asked++;
    panel.close();
    props.onOpenChange(false);
    previousFocus?.focus();
    previousFocus = undefined;
  };

  // Pointing at a menu opens it, and switching to the next one moves it along; a menu closes when
  // the pointer leaves it, so a click only has to open one that is not open yet
  const openMenu = (menu: TopMenu, button: HTMLElement) => {
    if (panel.open()?.menu === menu) return;
    void show(menu, button);
  };

  return (
    <nav
      data-menu-bar
      onPointerOver={cancelLeave}
      onPointerLeave={leave}
      class="flex shrink-0 items-center text-xs select-none"
    >
      <For each={TOP_MENUS}>
        {(menu) => (
          <button
            type="button"
            // The bar does not take the focus from the editor, so closing the menu gives typing back
            onPointerDown={(event) => event.preventDefault()}
            onClick={(event) => openMenu(menu, event.currentTarget)}
            onPointerEnter={(event) => openMenu(menu, event.currentTarget)}
            class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent aria-expanded:text-foreground aria-expanded:bg-accent transition-colors cursor-pointer"
            aria-haspopup="menu"
            aria-expanded={panel.open()?.menu === menu}
          >
            {t().menu[menu]}
          </button>
        )}
      </For>

      {/* Keyed: another menu is another panel, with its own position, highlight and submenu */}
      <Show when={panel.shown()} keyed>
        {(state) => (
          <MenuPopup
            entries={state.entries}
            anchor={state.anchor}
            closing={panel.closing()}
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

interface MenuButtonProps {
  /** Told whether the menu is open, so an immersive title bar can stay unfolded under it. */
  onOpenChange: (open: boolean) => void;
}

/**
 * Every top-level menu under one button, for a title bar that shares its room with the tabs. The
 * entries are asked for when the menu opens, like the menu bar's, because they follow the settings
 * and the open document.
 */
export const MenuButton: Component<MenuButtonProps> = (props) => {
  const panel = createPanelLifetime<{
    entries: readonly MenuEntry[];
    anchor: DOMRect;
  }>();
  let button: HTMLButtonElement | undefined;
  // Where the focus was before the button took it, so a command leaves the typing where it was
  let previousFocus: HTMLElement | undefined;
  // An answer to an earlier ask must not open a menu that was closed or switched meanwhile
  let asked = 0;

  const close = () => {
    asked++;
    panel.close();
    props.onOpenChange(false);
    previousFocus?.focus();
    previousFocus = undefined;
  };

  const toggle = async () => {
    if (panel.open() !== undefined) {
      close();
      return;
    }
    if (button === undefined) return;
    previousFocus ??=
      document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const request = ++asked;
    const anchor = button.getBoundingClientRect();
    const menus: Menus = await desktop.invoke("menu:items");
    if (request !== asked) return;
    panel.show({
      entries: TOP_MENUS.map((menu): MenuEntry => ({
        type: "item",
        id: menu,
        label: t().menu[menu],
        submenu: menus[menu],
      })),
      anchor,
    });
    props.onOpenChange(true);
  };

  return (
    <>
      <IconButton
        ref={(element) => (button = element)}
        data-menu-bar
        label={t().menu.menu}
        aria-haspopup="menu"
        aria-expanded={panel.open() !== undefined}
        class="text-muted-foreground"
        // The button does not take the focus from the editor, so closing the menu gives typing back
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => void toggle()}
      >
        <Menu />
      </IconButton>
      <Show when={panel.shown()} keyed>
        {(state) => (
          <MenuPopup
            entries={state.entries}
            anchor={state.anchor}
            closing={panel.closing()}
            onSelect={(entry) => {
              close();
              void desktop.invoke("menu:click", entry.id);
            }}
            onClose={close}
          />
        )}
      </Show>
    </>
  );
};
