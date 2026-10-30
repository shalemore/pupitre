import { Tabs as KobalteTabs } from "@kobalte/core/tabs";
import { X } from "lucide-solid";
import { createEffect, For, Show, type Component } from "solid-js";
import { IconButton } from "@/components/ui";
import { t } from "@/i18n";
import { isTabDirty, type Tab } from "@/lib/document-tab";
import { css, cx } from "@/styled-system/css";

export interface TabsBarProps {
  tabs: readonly Tab[];
  activeId: number | undefined;
  /** The name a tab shows: the file name, or the name of a document that has no file yet. */
  nameOf: (tab: Tab) => string;
  onActivate: (id: number) => void;
  onClose: (id: number) => void;
}

interface TabButtonProps {
  tab: Tab;
  name: string;
  active: boolean;
  onActivate: () => void;
  onClose: () => void;
}

const tabItem = css({
  position: "relative",
  display: "flex",
  height: "full",
  minWidth: 0,
  maxWidth: "48",
  flexShrink: 0,
  alignItems: "center",
  borderInlineEndWidth: "hairline",
  borderInlineEndStyle: "solid",
  borderInlineEndColor: "border.subtle",
  layerStyle: "interactive",
  _last: { borderInlineEndWidth: "0" },
});
const tabActive = css({ backgroundColor: "surface.1" });
const tabIdle = css({ _hover: { backgroundColor: "accent" } });
const trigger = css({
  display: "flex",
  height: "full",
  minWidth: 0,
  flex: "1",
  cursor: "pointer",
  alignItems: "center",
  gap: "1.5",
  paddingInline: "2.5",
  textStyle: "xs",
  outlineStyle: "none",
  userSelect: "none",
});
const triggerActive = css({ color: "foreground" });
const triggerIdle = css({ color: "muted.foreground", _hover: { color: "foreground" } });
const dirtyDot = css({
  width: "1.5",
  height: "1.5",
  flexShrink: 0,
  borderRadius: "full",
  backgroundColor: "brand",
});
const tabName = css({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
const closeButton = css({
  marginInlineEnd: "1",
  transitionProperty: "opacity",
  transitionDuration: "fast",
  transitionTimingFunction: "outExpo",
});
const closeButtonIdle = css({
  opacity: 0,
  _groupHover: { opacity: 1 },
  _groupFocusWithin: { opacity: 1 },
});
const activeUnderline = css({
  pointerEvents: "none",
  position: "absolute",
  insetInline: "0",
  bottom: "0",
  height: "0.5",
  backgroundColor: "brand",
});
const bar = css({
  display: "flex",
  height: "full",
  minWidth: 0,
  flex: "1",
  alignItems: "stretch",
});
const tabStrip = css({
  display: "flex",
  height: "full",
  minWidth: 0,
  flex: "1",
  alignItems: "stretch",
  overflowX: "auto",
  overscrollBehaviorX: "contain",
  _print: { display: "none" },
});

/** A tab as a title bar shows it: the name, a dirty dot and a close button, over the active fill. */
function TabButton(props: TabButtonProps) {
  let element: HTMLDivElement | undefined;

  // The shortcuts and a closing neighbour can bring a tab up while it sits past the edge of the strip
  createEffect(() => {
    if (props.active) element?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  return (
    <div
      ref={(node) => (element = node)}
      class={cx("group", tabItem, props.active ? tabActive : tabIdle)}
    >
      <KobalteTabs.Trigger
        value={String(props.tab.id)}
        title={props.name}
        onClick={() => props.onActivate()}
        onFocus={() => props.onActivate()}
        // A middle click closes the tab, as it does in every editor that has tabs
        onAuxClick={(event) => {
          if (event.button !== 1) return;
          event.preventDefault();
          props.onClose();
        }}
        class={cx(trigger, props.active ? triggerActive : triggerIdle)}
      >
        <Show when={isTabDirty(props.tab)}>
          <span aria-hidden="true" class={dirtyDot} />
        </Show>
        <bdi dir="ltr" class={tabName}>
          {props.name}
        </bdi>
      </KobalteTabs.Trigger>
      <IconButton
        label={t().menu.closeTab}
        size="icon-2xs"
        class={cx(closeButton, !props.active && closeButtonIdle)}
        onClick={props.onClose}
      >
        <X />
      </IconButton>
      <Show when={props.active}>
        <span aria-hidden="true" class={activeUnderline} />
      </Show>
    </div>
  );
}

/**
 * The open documents, in the title bar, once a second document is open. The title bar already names
 * the one document a single-tab window shows, so the strip only appears with more of them; sharing
 * the bar keeps the tabs inside the part that unfolds with the immersive chrome.
 */
export const TabsBar: Component<TabsBarProps> = (props) => (
  <KobalteTabs value={props.activeId === undefined ? "" : String(props.activeId)} class={bar}>
    <KobalteTabs.List
      aria-label={t().tabs.bar}
      // The strip scrolls sideways when the tabs overflow; the wheel follows the row, since a
      // vertical wheel over it has nothing else to do, and the scrollbar only appears when needed
      onWheel={(event) => {
        const strip = event.currentTarget;
        if (strip.scrollWidth <= strip.clientWidth) return;
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        event.preventDefault();
        strip.scrollLeft += event.deltaY;
      }}
      class={tabStrip}
    >
      <For each={props.tabs}>
        {(tab) => (
          <TabButton
            tab={tab}
            name={props.nameOf(tab)}
            active={tab.id === props.activeId}
            onActivate={() => props.onActivate(tab.id)}
            onClose={() => props.onClose(tab.id)}
          />
        )}
      </For>
    </KobalteTabs.List>
  </KobalteTabs>
);
