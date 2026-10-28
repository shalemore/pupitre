import { Menu } from "lucide-solid";
import { For, Show, type Component } from "solid-js";
import { TOP_MENUS, type MenuEntry, type Menus, type TopMenu } from "@shared/menu";
import { IconButton } from "@/components/ui";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { MenuPopup } from "./menu-popup";
import { createMenu } from "./menu-state";

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
  // Answers to earlier asks must not reopen a menu that was switched or closed in the meantime
  let asked = 0;
  const panel = createMenu<OpenMenu>({
    onOpenChange: props.onOpenChange,
    onClose: () => {
      asked++;
    },
  });

  const show = async (menu: TopMenu, button: HTMLElement) => {
    const request = ++asked;
    const menus: Menus = await desktop.invoke("menu:items");
    if (request !== asked) return;
    panel.show({ menu, entries: menus[menu], anchor: button.getBoundingClientRect() });
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
      onPointerOver={panel.cancelLeave}
      onPointerLeave={panel.leave}
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
              panel.close();
              void desktop.invoke("menu:click", entry.id);
            }}
            onClose={panel.close}
            onPointerOver={panel.cancelLeave}
            onPointerLeave={panel.leave}
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
  let button: HTMLButtonElement | undefined;
  // An answer to an earlier ask must not open a menu that was closed or switched meanwhile
  let asked = 0;
  const panel = createMenu<{
    entries: readonly MenuEntry[];
    anchor: DOMRect;
  }>({
    onOpenChange: props.onOpenChange,
    onClose: () => {
      asked++;
    },
  });

  const toggle = async () => {
    if (panel.open() !== undefined) {
      panel.close();
      return;
    }
    if (button === undefined) return;
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
              panel.close();
              void desktop.invoke("menu:click", entry.id);
            }}
            onClose={panel.close}
          />
        )}
      </Show>
    </>
  );
};
