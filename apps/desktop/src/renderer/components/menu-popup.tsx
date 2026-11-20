import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
} from "@ui-sdk/solid/menu";
import type { MenuEntry } from "@pupitre/desktop-api/menu";
import { Separator } from "@pupitre/ui";
import { FLOATING_PANEL, menuPanel, rtlFlip, truncate } from "@pupitre/ui/styles";
import { Check, ChevronRight } from "lucide-solid";
import { For, Show, type Component } from "solid-js";
import { isRtl } from "@/lib/rtl";
import { settings } from "@/lib/settings";
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
const row = css({ display: "flex", minWidth: "0", flex: "1", alignItems: "center", gap: "1.5" });
const label = css({ minWidth: "0" });
const block = css({ display: "block" });
const detail = css({ display: "block", textStyle: "2xs", color: "tertiary" });
const shortcut = css({ textStyle: "2xs", color: "tertiary", fontVariantNumeric: "tabular-nums" });
const item = css({
  display: "flex",
  width: "full",
  alignItems: "center",
  gap: "6",
  borderRadius: "sm",
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

const ItemContent: Component<{ item: MenuItemEntry; checked: boolean; hasChecks: boolean }> = (
  props,
) => (
  <>
    <span class={row}>
      <Show when={props.hasChecks}>
        <Check class={cx(check, !props.checked && hidden)} stroke-width={2} />
      </Show>
      <span class={label}>
        <Show
          when={props.item.detail}
          fallback={<span class={cx(truncate, block)}>{props.item.label}</span>}
        >
          {/* A recent file's name is document text, not a UI label; its path is isolated below */}
          <bdi dir="auto" class={cx(truncate, block)}>
            {props.item.label}
          </bdi>
        </Show>
        <Show when={props.item.detail}>
          <bdi dir="auto" class={cx(truncate, block, detail)}>
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
  const isCheck = (entry: MenuItemEntry) =>
    entry.checked !== undefined || entry.setting !== undefined;
  const hasChecks = () => props.entries.some((entry) => entry.type === "item" && isCheck(entry));
  // A check that stands for a setting follows the live value, not the snapshot the menu opened with
  const checked = (entry: MenuItemEntry): boolean =>
    entry.setting === undefined
      ? entry.checked === true
      : settings()[entry.setting] !== (entry.invert === true);

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
                  when={isCheck(itemEntry())}
                  fallback={
                    <MenuItem
                      disabled={itemEntry().enabled === false}
                      onSelect={() => props.onSelect(itemEntry())}
                      class={item}
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
                    class={item}
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
                <MenuSubTrigger disabled={itemEntry().enabled === false} class={item}>
                  <ItemContent
                    item={itemEntry()}
                    checked={checked(itemEntry())}
                    hasChecks={hasChecks()}
                  />
                  <ChevronRight class={cx(submenuChevron, rtlFlip)} />
                </MenuSubTrigger>
                <MenuSubContent class={cx(FLOATING_PANEL, menuPanel)}>
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
    <MenuContent
      data-menu-panel=""
      anchor={{ getBoundingClientRect: () => props.anchor }}
      side="bottom"
      align={isRtl() ? "end" : "start"}
      sideOffset={2}
      class={cx(FLOATING_PANEL, menuPanel)}
    >
      <MenuEntries entries={props.entries} onSelect={props.onSelect} />
    </MenuContent>
  </Menu>
);
