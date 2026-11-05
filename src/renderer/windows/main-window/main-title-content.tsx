import { Show, type Component, type JSX } from "solid-js";
import { MenuBar, MenuButton } from "@/features/menu-bar";
import { TabsBar } from "@/features/tabs-bar";
import { isMacOS } from "@/lib/desktop";
import type { Tab } from "@/lib/document/tab";
import { truncate } from "@/lib/styles";
import { dirtyDot, titleCenter, titleEnd, titleGrid, titleStart } from "../main-window-styles";

interface MainTitleContentProps {
  /** Whether the bar holds the tabs, which it does with several documents. */
  tabsShown: boolean;
  fileName: string | undefined;
  dirty: boolean;
  tabs: readonly Tab[];
  activeId: number | undefined;
  nameOf: (tab: Tab) => string;
  onActivate: (id: number) => void;
  onClose: (id: number) => void;
  /** The word count, which ends the bar in either layout. */
  count: JSX.Element;
  onMenuOpenChange: (open: boolean) => void;
}

/**
 * What the main window's title bar holds: the document's name between the menus, or the tabs with the menus
 * folded into one button so the strip does not sit under a bar that unfolds as the pointer reaches
 * for it.
 */
export const MainTitleContent: Component<MainTitleContentProps> = (props) => (
  <>
    <Show
      when={props.tabsShown}
      fallback={
        // Equal side columns keep the document name in the middle of the bar, whatever the menus
        // and the count take
        <div data-title-grid class={titleGrid}>
          <div class={titleStart}>
            <Show when={!isMacOS}>
              <MenuBar onOpenChange={props.onMenuOpenChange} />
            </Show>
          </div>

          <div class={titleCenter}>
            <Show when={props.fileName !== undefined}>
              <Show when={props.dirty}>
                <span aria-hidden="true" class={dirtyDot} />
              </Show>
              <bdi dir="auto" class={truncate}>
                {props.fileName}
              </bdi>
            </Show>
          </div>

          <div class={titleEnd}>{props.count}</div>
        </div>
      }
    >
      <Show when={!isMacOS}>
        <MenuButton onOpenChange={props.onMenuOpenChange} />
      </Show>
      <TabsBar
        tabs={props.tabs}
        activeId={props.activeId}
        nameOf={props.nameOf}
        onActivate={props.onActivate}
        onClose={props.onClose}
      />
    </Show>

    <Show when={props.tabsShown}>{props.count}</Show>
  </>
);
