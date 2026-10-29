import { Menubar } from "@kobalte/core/menubar";
import { makeEventListener } from "@solid-primitives/event-listener";
import { debounce } from "@solid-primitives/scheduled";
import { Menu } from "lucide-solid";
import { createSignal, For, Show, type Component } from "solid-js";
import { TOP_MENUS, type MenuEntry, type Menus, type TopMenu } from "@shared/menu";
import { IconButton } from "@/components/ui";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { MenuEntries, MenuPopup } from "./menu-popup";
import { createMenu } from "./menu-state";

/** How long the pointer may be away from the bar and its menus before they fold up. */
const LEAVE_DELAY = 200;
/**
 * A menu hands the focus back to its trigger while it closes, and the trigger opens its menu again
 * when it takes the focus; a value that arrives this soon after a close is that hand-back.
 */
const CLOSE_GUARD_MS = 500;

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
  let closedAt = 0;
  // A bar that takes the tabs' place appears under a still pointer, and the browser then sends
  // the trigger under it a mouseover. Until the pointer moves, that hover is the bar arriving,
  // not a request for a menu.
  let pointerMoved = false;
  let hoverFromRest = false;
  makeEventListener(document, "pointermove", () => {
    pointerMoved = true;
  });

  const load = async (menu: TopMenu) => {
    const request = ++asked;
    const menus: Menus = await desktop.invoke("menu:items");
    if (request !== asked) return;
    setEntries((current) => ({ ...current, [menu]: menus[menu] }));
  };

  const show = (menu: TopMenu) => {
    const current = open();
    if (current === undefined) {
      previousFocus =
        document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
      setInstant(undefined);
    } else if (current !== menu) {
      setInstant(menu);
    }
    setOpen(menu);
    props.onOpenChange(true);
    void load(menu);
  };

  const hide = () => {
    if (open() === undefined) return;
    closedAt = performance.now();
    setOpen(undefined);
    props.onOpenChange(false);
    const target = previousFocus;
    previousFocus = undefined;
    // The menu gives the focus back to its trigger, so the editor takes it again afterwards
    queueMicrotask(() => target?.focus());
  };

  const change = (value: string | null | undefined) => {
    // Kobalte switches the bar from the trigger's mouseover; the one the bar gets on arrival is
    // dropped here, before it can open a menu
    if (hoverFromRest) {
      hoverFromRest = false;
      return;
    }
    const menu = TOP_MENUS.find((candidate) => candidate === value);
    if (menu === undefined) hide();
    else if (performance.now() - closedAt > CLOSE_GUARD_MS) show(menu);
  };

  // A menu opened by pointing leaves the focus where it was, outside the panel the menu closes
  // itself from; Escape closes it from here, and the panel handles it too when it has the focus
  makeEventListener(document, "keydown", (event) => {
    if (event.key === "Escape" && open() !== undefined) hide();
  });

  // The bar and its panels fold away once the pointer is away from both; Kobalte keeps a menubar
  // open until something is clicked, which a title bar does not.
  const leave = debounce(() => change(undefined), LEAVE_DELAY);
  makeEventListener(document, "pointermove", (event) => {
    if (open() === undefined) return;
    const target = event.target;
    const inside =
      target instanceof Element && target.closest('[data-menu-bar], [role="menu"]') !== null;
    if (inside) leave.clear();
    else leave();
  });

  // A press on the bar does not take the focus from the editor, and does not reach the menubar:
  // pointing already opened the menu, so the press must not toggle it shut
  const keepEditorFocus = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <Menubar
      ref={(element) => {
        element.addEventListener("pointerdown", keepEditorFocus, true);
        // A closing menu hands the focus back to its trigger, and a trigger that takes the focus
        // opens its menu again; with no menu open, a focus on the bar is that hand-back.
        element.addEventListener(
          "focusin",
          (event) => {
            if (open() !== undefined) return;
            event.stopPropagation();
            // The menu hands the focus back to its trigger while it folds; the document takes it
            if (
              performance.now() - closedAt < CLOSE_GUARD_MS &&
              event.target instanceof HTMLElement
            ) {
              document.querySelector<HTMLElement>(".cm-content")?.focus();
            }
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
      value={open() ?? ""}
      onValueChange={change}
      // A pointer over a trigger opens its menu, which the bar reads from the value it controls
      autoFocusMenu
      class="flex shrink-0 items-center text-xs select-none"
    >
      <For each={TOP_MENUS}>
        {(menu) => (
          <Menubar.Menu
            value={menu}
            // Escape, a click beside the menu and a picked entry close it without changing the bar's
            // value; this keeps the bar's own state with it
            onOpenChange={(isOpen) => {
              // Switching to another menu closes this one too, but the bar already points at the other
              if (!isOpen && open() === menu) hide();
            }}
          >
            <Menubar.Trigger
              // Kobalte opens a menu from the trigger's mouseover; a bar that has just arrived
              // under a still pointer gets one without the pointer asking for a menu
              onMouseOver={() => {
                hoverFromRest = !pointerMoved && open() === undefined;
                // The change this hover causes comes synchronously; a flag that outlived it
                // would swallow the next keyboard or focus change
                queueMicrotask(() => {
                  hoverFromRest = false;
                });
              }}
              // Pointing opened it already; the click that follows must not toggle it shut
              onClick={() => show(menu)}
              class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent data-expanded:text-foreground data-expanded:bg-accent transition-colors cursor-pointer"
            >
              {t().menu[menu]}
            </Menubar.Trigger>
            <Menubar.Portal>
              <Menubar.Content
                data-instant={instant() === menu ? "" : undefined}
                class="floating-panel z-50 flex min-w-52 max-h-(--kb-popper-content-available-height) flex-col overflow-y-auto overscroll-contain p-1 text-xs text-foreground outline-none select-none"
              >
                <MenuEntries
                  entries={entries()[menu] ?? []}
                  onSelect={(entry) => {
                    hide();
                    void desktop.invoke("menu:click", entry.id);
                  }}
                />
              </Menubar.Content>
            </Menubar.Portal>
          </Menubar.Menu>
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
