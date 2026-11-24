import type { MenuEntry } from "@pupitre/desktop-api/menu";
import { cn, ScrollView, Separator } from "@pupitre/ui";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
} from "@ui-sdk/solid/menu";
import { cva } from "class-variance-authority";
import { Check, ChevronRight } from "lucide-solid";
import { For, omit, Show, createMemo, type Component } from "solid-js";
import { isRtl } from "@/lib/rtl";
import { settings } from "@/lib/settings";

type MenuItemEntry = Extract<MenuEntry, { type: "item" }>;

export interface MenuPopupProps {
  entries: readonly MenuEntry[];
  /** The rect the panel is placed against, in viewport coordinates. */
  anchor: DOMRect;
  /** Whether the menu is folding away; the panel stays drawn until its exit animation has played. */
  closing?: boolean | undefined;
  onSelect: (entry: MenuItemEntry) => void;
  onClose: () => void;
}

const menuPanel = cva(
  "__FLOATING_PANEL__ z-50 flex max-h-(--kb-popper-content-available-height) min-w-52 flex-col overflow-hidden rounded-sm p-1 text-xs text-foreground outline-none select-none",
);

export type MenuPanelProps = Parameters<typeof MenuContent>[0];

/** The shared floating menu surface used by title-bar menus and context menus. */
export const MenuPanel: Component<MenuPanelProps> = (props) => {
  const rest = omit(props, "class", "children");
  return (
    <MenuContent {...rest} class={cn(menuPanel(), props.class)}>
      {(state) => (
        <ScrollView class="flex flex-col">
          {typeof props.children === "function" ? props.children(state) : props.children}
        </ScrollView>
      )}
    </MenuContent>
  );
};

const item = cva(
  "flex w-full items-center gap-6 rounded-sm px-2.5 py-1.5 text-start transition-colors duration-fast ease-out-expo outline-none disabled:text-tertiary data-highlighted:bg-accent data-highlighted:text-foreground",
);

const ItemContent: Component<{ item: MenuItemEntry; checked: boolean; hasChecks: boolean }> = (
  props,
) => (
  <>
    <span class="flex min-w-0 flex-1 items-center gap-1.5">
      <Show when={props.hasChecks}>
        <Check class={cn("size-3 shrink-0", !props.checked && "invisible")} stroke-width={2} />
      </Show>
      <span class="min-w-0">
        <Show
          when={props.item.detail}
          fallback={<span class="block truncate">{props.item.label}</span>}
        >
          {/* A recent file's name is document text, not a UI label; its path is isolated below */}
          <bdi dir="auto" class="block truncate">
            {props.item.label}
          </bdi>
        </Show>
        <Show when={props.item.detail}>
          <bdi dir="auto" class="block truncate text-2xs text-tertiary">
            {props.item.detail}
          </bdi>
        </Show>
      </span>
    </span>
    <Show when={props.item.shortcut}>
      <bdi dir="ltr" class="text-2xs text-tertiary tabular-nums">
        {props.item.shortcut}
      </bdi>
    </Show>
  </>
);

export const MenuEntries: Component<{
  entries: readonly MenuEntry[];
  onSelect: (entry: MenuItemEntry) => void;
}> = (props) => {
  const isCheck = (entry: MenuItemEntry) =>
    entry.checked !== undefined || entry.setting !== undefined;
  const hasChecks = () => props.entries.some((entry) => entry.type === "item" && isCheck(entry));
  // A check that stands for a setting follows the live value, not the snapshot the menu opened with
  const checked = (entry: MenuItemEntry): boolean =>
    entry.setting === undefined
      ? entry.checked === true
      : settings()[entry.setting] !== (entry.invert === true);
  // The host rebuilds a menu's entries each time it opens, so every record arrives as a fresh
  // object. A row is keyed by its id, not its identity, so its DOM and highlight survive a re-fetch;
  // a separator has no id and no state to lose, so its place in the list names it.
  const keyed = createMemo(() => {
    let separators = 0;
    return props.entries.map((entry) => ({
      key: entry.type === "item" ? entry.id : `separator:${separators++}`,
      entry,
    }));
  });

  return (
    <For each={keyed()} keyed={(keyedEntry) => keyedEntry.key}>
      {(keyedEntry) => (
        <Show
          when={(() => {
            const entry = keyedEntry().entry;
            return entry.type === "item" ? entry : undefined;
          })()}
          fallback={<Separator class="my-1 bg-border-subtle" />}
        >
          {(itemEntry) => (
            <Show
              when={itemEntry().submenu}
              fallback={
                <Show
                  when={isCheck(itemEntry())}
                  fallback={
                    <MenuItem
                      disabled={itemEntry().enabled === false}
                      onSelect={() => props.onSelect(itemEntry())}
                      class={item()}
                    >
                      <ItemContent
                        item={itemEntry()}
                        checked={checked(itemEntry())}
                        hasChecks={hasChecks()}
                      />
                    </MenuItem>
                  }
                >
                  <MenuCheckboxItem
                    value={itemEntry().id}
                    checked={checked(itemEntry())}
                    disabled={itemEntry().enabled === false}
                    onCheckedChange={() => props.onSelect(itemEntry())}
                    class={item()}
                  >
                    <ItemContent
                      item={itemEntry()}
                      checked={checked(itemEntry())}
                      hasChecks={hasChecks()}
                    />
                  </MenuCheckboxItem>
                </Show>
              }
            >
              <MenuSub>
                <MenuSubTrigger disabled={itemEntry().enabled === false} class={item()}>
                  <ItemContent
                    item={itemEntry()}
                    checked={checked(itemEntry())}
                    hasChecks={hasChecks()}
                  />
                  <ChevronRight class="size-3.5 shrink-0 text-tertiary rtl:-scale-x-100" />
                </MenuSubTrigger>
                <MenuSubContent class={menuPanel()}>
                  <MenuEntries entries={itemEntry().submenu ?? []} onSelect={props.onSelect} />
                </MenuSubContent>
              </MenuSub>
            </Show>
          )}
        </Show>
      )}
    </For>
  );
};

/**
 * A menu drawn by the window, under the title bar or at the pointer. UI SDK places it, moves the
 * highlight with the keyboard and closes it; the bar keeps it open while the pointer is over it.
 */
export const MenuPopup: Component<MenuPopupProps> = (props) => (
  <Menu
    open={!props.closing}
    modal={false}
    onOpenChange={(open, details) => {
      if (open) return;
      const target = details.event?.target;
      // A click in the bar is the bar's business: it switches or closes the menu itself
      if (target instanceof Element && target.closest("[data-menu-bar]") !== null) {
        details.cancel();
        return;
      }
      props.onClose();
    }}
  >
    <MenuPanel
      data-menu-panel=""
      anchor={{ getBoundingClientRect: () => props.anchor }}
      side="bottom"
      align={isRtl() ? "end" : "start"}
      sideOffset={2}
    >
      <MenuEntries entries={props.entries} onSelect={props.onSelect} />
    </MenuPanel>
  </Menu>
);
