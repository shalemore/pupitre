import {
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuPortal,
  MenuRoot,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
} from "@kobalte/core/menu";
import { cn } from "cn";
import { Check, ChevronRight } from "lucide-solid";
import { For, Show, type Component } from "solid-js";
import type { MenuEntry } from "@shared/menu";
import { Separator } from "@/components/ui";
import { isRtl } from "@/lib/rtl";

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

const ItemContent: Component<{ item: MenuItemEntry; hasChecks: boolean }> = (props) => (
  <>
    <span class="flex min-w-0 flex-1 items-center gap-1.5">
      <Show when={props.hasChecks}>
        <Check
          class={cn("size-3 shrink-0", props.item.checked !== true && "invisible")}
          stroke-width={2}
        />
      </Show>
      <span class="min-w-0">
        <span class="block truncate">{props.item.label}</span>
        <Show when={props.item.detail}>
          <bdi dir="ltr" class="block truncate text-2xs text-tertiary">
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
  const hasChecks = () =>
    props.entries.some((entry) => entry.type === "item" && entry.checked !== undefined);

  return (
    <For each={props.entries}>
      {(entry) => (
        <Show
          when={entry.type === "item" ? entry : undefined}
          fallback={<Separator class="my-1 bg-border-subtle" />}
        >
          {(item) => (
            <Show
              when={item().submenu}
              fallback={
                <Show
                  when={item().checked !== undefined}
                  fallback={
                    <MenuItem
                      disabled={item().enabled === false}
                      onSelect={() => props.onSelect(item())}
                      class="flex w-full items-center gap-6 rounded-md px-2.5 py-1.5 text-start outline-none transition-colors duration-fast data-disabled:text-tertiary data-highlighted:bg-accent data-highlighted:text-foreground"
                    >
                      <ItemContent item={item()} hasChecks={hasChecks()} />
                    </MenuItem>
                  }
                >
                  <MenuCheckboxItem
                    checked={item().checked === true}
                    disabled={item().enabled === false}
                    onSelect={() => props.onSelect(item())}
                    class="flex w-full items-center gap-6 rounded-md px-2.5 py-1.5 text-start outline-none transition-colors duration-fast data-disabled:text-tertiary data-highlighted:bg-accent data-highlighted:text-foreground"
                  >
                    <ItemContent item={item()} hasChecks={hasChecks()} />
                  </MenuCheckboxItem>
                </Show>
              }
            >
              <MenuSub>
                <MenuSubTrigger
                  disabled={item().enabled === false}
                  class="flex w-full items-center gap-6 rounded-md px-2.5 py-1.5 text-start outline-none transition-colors duration-fast data-disabled:text-tertiary data-highlighted:bg-accent data-highlighted:text-foreground"
                >
                  <ItemContent item={item()} hasChecks={hasChecks()} />
                  <ChevronRight class="size-3.5 shrink-0 text-tertiary rtl:-scale-x-100" />
                </MenuSubTrigger>
                <MenuPortal>
                  <MenuSubContent class="floating-panel z-50 flex min-w-52 max-h-(--kb-popper-content-available-height) flex-col overflow-y-auto overscroll-contain p-1 text-xs text-foreground outline-none select-none">
                    <MenuEntries entries={item().submenu ?? []} onSelect={props.onSelect} />
                  </MenuSubContent>
                </MenuPortal>
              </MenuSub>
            </Show>
          )}
        </Show>
      )}
    </For>
  );
};

/**
 * A menu drawn by the window, under the title bar or at the pointer. Kobalte places it, moves the
 * highlight with the keyboard and closes it; the bar keeps it open while the pointer is over it.
 */
export const MenuPopup: Component<MenuPopupProps> = (props) => (
  <MenuRoot
    open={!props.closing}
    modal={false}
    placement={isRtl() ? "bottom-end" : "bottom-start"}
    gutter={2}
    fitViewport
    getAnchorRect={() => props.anchor}
    onOpenChange={(open) => {
      if (!open) props.onClose();
    }}
  >
    <MenuPortal>
      <MenuContent
        data-menu-panel=""
        onInteractOutside={(event) => {
          // A click in the bar is the bar's business: it switches or closes the menu itself
          if (event.target instanceof Element && event.target.closest("[data-menu-bar]") !== null) {
            event.preventDefault();
          }
        }}
        class="floating-panel z-50 flex min-w-52 max-h-(--kb-popper-content-available-height) flex-col overflow-y-auto overscroll-contain p-1 text-xs text-foreground outline-none select-none"
      >
        <MenuEntries entries={props.entries} onSelect={props.onSelect} />
      </MenuContent>
    </MenuPortal>
  </MenuRoot>
);
