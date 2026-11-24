import { desktop } from "@pupitre/desktop-api/client";
import { TOP_MENUS, type MenuEntry, type Menus, type TopMenu } from "@pupitre/desktop-api/menu";
import { t } from "@pupitre/i18n/solid";
import { IconButton } from "@pupitre/ui";
import { makeEventListener } from "@solid-primitives/event-listener";
import { Menu as UiMenu, MenuTrigger } from "@ui-sdk/solid/menu";
import { Menubar } from "@ui-sdk/solid/menubar";
import { Menu } from "lucide-solid";
import { createSignal, For, Show, type Component } from "solid-js";
import { MenuEntries, MenuPanel, MenuPopup } from "@/components/menu-popup";
import { createMenu } from "@/lib/menu-state";

/** How soon after a menu closes the next one is still taking its place rather than arriving. */
const SWITCH_WINDOW_MS = 100;

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
  const [open, setOpen] = createSignal<TopMenu>();
  // The menu that takes another's place: it appears at once rather than arriving again
  const [instant, setInstant] = createSignal<TopMenu>();
  const [entries, setEntries] = createSignal<Partial<Record<TopMenu, readonly MenuEntry[]>>>({});
  // Answers to earlier asks must not replace the entries of a menu opened after them
  let asked = 0;
  // Where the focus goes back to once the menu folds; the editor held it before
  let previousFocus: HTMLElement | undefined;
  // When the last menu closed, so one opened at once after it takes its place instead of arriving
  let closedAt = 0;

  const load = async (menu: TopMenu) => {
    const request = ++asked;
    const menus: Menus = await desktop.invoke("menu:items");
    if (request !== asked) return;
    setEntries((current) => ({ ...current, [menu]: menus[menu] }));
  };

  const show = (menu: TopMenu) => {
    if (open() === menu) return;
    const current = open();
    // A menu that takes the place of the one just closed appears at once, without replaying the
    // arrival under the pointer
    const replacing = current !== undefined || performance.now() - closedAt < SWITCH_WINDOW_MS;
    if (current === undefined) {
      // The pointer pre-captured the editor before the bar took the focus; only a menu opened
      // without the pointer, such as from the keyboard, has to look for it now
      previousFocus ??=
        document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    }
    setInstant(replacing ? menu : undefined);
    setOpen(menu);
    props.onOpenChange(true);
    void load(menu);
  };

  const hide = () => {
    if (open() === undefined) return;
    closedAt = performance.now();
    const target = previousFocus;
    setOpen(undefined);
    props.onOpenChange(false);
    // The menu gives the focus back to its trigger as it folds; the editor takes it again after,
    // unless another menu has taken this one's place
    window.setTimeout(() => {
      if (open() === undefined) target?.focus();
    }, 0);
  };

  // A menu opened with the pointer leaves the focus in the editor, outside the panel that would
  // otherwise handle the key
  makeEventListener(document, "keydown", (event) => {
    if (event.key === "Escape" && open() !== undefined) hide();
  });

  return (
    <Menubar
      ref={(element) => {
        // A press on the bar does not take the focus from the document; the open menu does, and
        // gives it back once it folds
        element.addEventListener(
          "pointerdown",
          (event) => {
            if (event.button === 0) event.preventDefault();
          },
          true,
        );
        // A trigger that takes the focus opens its menu; the bar opens menus from a press or the
        // keyboard only. Without this, the focus a closing menu hands back to its trigger would
        // open the menu again.
        element.addEventListener(
          "focusin",
          (event) => {
            if (open() === undefined) event.stopPropagation();
          },
          true,
        );
      }}
      data-menu-bar
      // The menu takes the focus with it; where it was belongs back to it once the menu folds
      onPointerEnter={() => {
        if (open() === undefined) {
          previousFocus =
            document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
        }
      }}
      class="flex shrink-0 items-center text-xs select-none"
    >
      <For each={TOP_MENUS}>
        {(menu) => (
          <UiMenu
            open={open() === menu}
            onOpenChange={(isOpen, details) => {
              if (isOpen) {
                show(menu);
                return;
              }
              // A press on another trigger is the bar's business: it switches or closes the menu
              // itself. Without this, a press folds the open menu first, and the menu the click
              // brings up arrives with the rise instead of taking its place. Hovering across the
              // bar switches through the SDK instead, so only a press takes this path.
              if (details.reason === "trigger-press") {
                details.cancel();
                return;
              }
              if (open() === menu) hide();
            }}
          >
            <MenuTrigger class="__INTERACTIVE__ shrink-0 cursor-pointer rounded-md px-2.5 py-1 whitespace-nowrap text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground">
              {t().menu[menu]}
            </MenuTrigger>
            <MenuPanel
              side="bottom"
              align="start"
              sideOffset={8}
              data-instant={instant() === menu ? "" : undefined}
              class="mt-2"
            >
              <MenuEntries
                entries={entries()[menu] ?? []}
                onSelect={(entry) => {
                  hide();
                  void desktop.invoke("menu:click", entry.id);
                }}
              />
            </MenuPanel>
          </UiMenu>
        )}
      </For>
    </Menubar>
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
        aria-expanded={panel.open() !== undefined ? "true" : "false"}
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
