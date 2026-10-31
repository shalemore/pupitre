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
import { Check, ChevronRight } from "lucide-solid";
import { For, Show, type Component } from "solid-js";
import type { MenuEntry } from "@shared/menu";
import { Separator } from "@/components/ui";
import { isRtl } from "@/lib/rtl";
import { FLOATING_PANEL, menuPanel, rtlFlip, truncate } from "@/lib/styles";
import { css, cx } from "@/styled-system/css";

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

const check = css({ width: "3", height: "3", flexShrink: 0 });
const hidden = css({ visibility: "hidden" });
const row = css({ display: "flex", minWidth: 0, flex: "1", alignItems: "center", gap: "1.5" });
const label = css({ minWidth: 0 });
const block = css({ display: "block" });
const detail = css({ display: "block", textStyle: "2xs", color: "tertiary" });
const shortcut = css({ textStyle: "2xs", color: "tertiary", fontVariantNumeric: "tabular-nums" });
const item = css({
  display: "flex",
  width: "full",
  alignItems: "center",
  gap: "6",
  borderRadius: "md",
  paddingInline: "2.5",
  paddingBlock: "1.5",
  textAlign: "start",
  outlineStyle: "none",
  transition: "colors",
  transitionDuration: "fast",
  transitionTimingFunction: "outExpo",
  _disabled: { color: "tertiary" },
  _highlighted: { backgroundColor: "accent", color: "foreground" },
});
const submenuChevron = css({
  width: "3.5",
  height: "3.5",
  flexShrink: 0,
  color: "tertiary",
});
const separator = css({ marginBlock: "1", backgroundColor: "border.subtle" });

const ItemContent: Component<{ item: MenuItemEntry; hasChecks: boolean }> = (props) => (
  <>
    <span class={row}>
      <Show when={props.hasChecks}>
        <Check class={cx(check, props.item.checked !== true && hidden)} stroke-width={2} />
      </Show>
      <span class={label}>
        <span class={cx(truncate, block)}>{props.item.label}</span>
        <Show when={props.item.detail}>
          <bdi dir="ltr" class={cx(truncate, block, detail)}>
            {props.item.detail}
          </bdi>
        </Show>
      </span>
    </span>
    <Show when={props.item.shortcut}>
      <bdi dir="ltr" class={shortcut}>
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
          fallback={<Separator class={separator} />}
        >
          {(itemEntry) => (
            <Show
              when={itemEntry().submenu}
              fallback={
                <Show
                  when={itemEntry().checked !== undefined}
                  fallback={
                    <MenuItem
                      disabled={itemEntry().enabled === false}
                      onSelect={() => props.onSelect(itemEntry())}
                      class={item}
                    >
                      <ItemContent item={itemEntry()} hasChecks={hasChecks()} />
                    </MenuItem>
                  }
                >
                  <MenuCheckboxItem
                    checked={itemEntry().checked === true}
                    disabled={itemEntry().enabled === false}
                    onSelect={() => props.onSelect(itemEntry())}
                    class={item}
                  >
                    <ItemContent item={itemEntry()} hasChecks={hasChecks()} />
                  </MenuCheckboxItem>
                </Show>
              }
            >
              <MenuSub>
                <MenuSubTrigger disabled={itemEntry().enabled === false} class={item}>
                  <ItemContent item={itemEntry()} hasChecks={hasChecks()} />
                  <ChevronRight class={cx(submenuChevron, rtlFlip)} />
                </MenuSubTrigger>
                <MenuPortal>
                  <MenuSubContent class={cx(FLOATING_PANEL, menuPanel)}>
                    <MenuEntries entries={itemEntry().submenu ?? []} onSelect={props.onSelect} />
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
        class={cx(FLOATING_PANEL, menuPanel)}
      >
        <MenuEntries entries={props.entries} onSelect={props.onSelect} />
      </MenuContent>
    </MenuPortal>
  </MenuRoot>
);
