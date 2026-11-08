import { IconButton, ScrollView, SegmentedControl, ToggleIconButton } from "@pupitre/ui";
import { quietButton, rtlFlip, truncateStyle } from "@pupitre/ui/styles";
import { ChevronRight, Folder, ListTree, Pin } from "lucide-solid";
import { createSignal, type Component, type JSX, Show } from "solid-js";
import { t } from "@/i18n";
import { distanceFromEnd, distanceFromStart, isRtl } from "@/lib/rtl";
import { SIDEBAR_WIDTH, type SidebarSide } from "@/lib/sidebar";
import { css, cx } from "@/styled-system/css";
import type { SidebarControl } from "./sidebar-control";

export type SidebarMode = "outline" | "folder";

/** The strip left at the edge of a classic window while a sidebar is collapsed. */
const RAIL_WIDTH = 24;

/** What a collapsed classic sidebar leaves at the window edge, so it can be opened again. */
export interface SidebarRail {
  label: string;
  onExpand: () => void;
}

const KEYBOARD_STEP = 16;

const slot = css({
  position: "relative",
  flexShrink: 0,
  overflow: "hidden",
  _print: { display: "none" },
});
const resizing = css({
  transitionProperty: "width",
  transitionDuration: "sheet",
  transitionTimingFunction: "outExpo",
});
const fullHeight = css({ height: "full" });
const handle = css({
  layerStyle: "interactive",
  position: "absolute",
  insetBlock: "0",
  zIndex: "10",
  width: "1",
  cursor: "col-resize",
  outlineStyle: "none",
  borderStyle: "solid",
  borderColor: "transparent",
  _hover: { borderColor: "brand/30" },
  _focusVisible: { borderColor: "brand/30" },
});
const handleAtStart = css({ insetInlineEnd: "0", borderInlineEndWidth: "hairline" });
const handleAtEnd = css({ insetInlineStart: "0", borderInlineStartWidth: "hairline" });
const handleDragging = css({ borderColor: "brand/40" });
const railBase = css({
  position: "absolute",
  insetBlock: "0",
  insetInline: "0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "surface.0",
});
const railAtStart = css({
  borderInlineEndWidth: "hairline",
  borderInlineEndStyle: "solid",
  borderInlineEndColor: "border",
});
const railAtEnd = css({
  borderInlineStartWidth: "hairline",
  borderInlineStartStyle: "solid",
  borderInlineStartColor: "border",
});
const frame = css({
  display: "flex",
  flexDirection: "column",
  backgroundColor: "surface.0",
  userSelect: "none",
  flexShrink: 0,
  textStyle: "xs",
  width: "full",
  height: "full",
  _print: { display: "none" },
});
const rotated = css({ rotate: "[45deg]" });
const rotate180 = css({ rotate: "[180deg]" });
const titleRow = css({
  display: "flex",
  alignItems: "center",
  gap: "1",
  paddingInlineStart: "4",
  paddingInlineEnd: "2",
  paddingBlockStart: "2",
});
const titleMain = css({
  display: "flex",
  minWidth: "0",
  flex: "1",
  alignItems: "center",
  gap: "1",
});
const titleText = css(truncateStyle, {
  minWidth: "0",
  textStyle: "2xs",
  fontWeight: "medium",
  color: "muted.foreground",
});
const modeRow = css({
  margin: "2",
  marginBlockEnd: "0",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "1",
});
const grow = css({ minWidth: "0", flex: "1" });
const hidden = css({ display: "none" });

interface SidebarSlotProps {
  side: SidebarSide;
  shown: boolean;
  width: number;
  /** The widest this sidebar may be while the pair leaves the document its room. */
  maxWidth: number;
  /** Names the resize handle for anyone who cannot see it. */
  label: string;
  onWidthChange: (width: number) => void;
  /** What the edge shows while a classic sidebar is collapsed; absent when the window folds by itself. */
  rail?: SidebarRail | undefined;
  children: JSX.Element;
}

/**
 * Where a sidebar sits next to the document. Collapsing animates the width and the document
 * takes the freed room; inert keeps a hidden sidebar out of the tab order. A classic window
 * leaves a rail at the edge so a collapsed sidebar can be opened again. The edge towards the
 * document is a handle that resizes the sidebar by dragging or with the arrow keys; double-click
 * restores the initial width.
 */
export const SidebarSlot: Component<SidebarSlotProps> = (props) => {
  const [dragging, setDragging] = createSignal(false);
  const folded = () => !props.shown && props.rail !== undefined;
  const shownWidth = () => Math.min(props.width, props.maxWidth);
  const resize = (width: number) =>
    props.onWidthChange(
      Math.min(props.maxWidth, Math.max(SIDEBAR_WIDTH.min, Math.min(SIDEBAR_WIDTH.max, width))),
    );
  /** How far the pointer is from the window edge this sidebar sits at. */
  const fromEdge = (clientX: number) =>
    props.side === "start" ? distanceFromStart(clientX) : distanceFromEnd(clientX);

  return (
    <div
      // The resize handle belongs to the sidebar as far as the immersive window's hover goes
      data-sidebar={props.side}
      style={{
        width: props.shown ? `${shownWidth()}px` : folded() ? `${RAIL_WIDTH}px` : "0px",
      }}
      class={cx(
        slot,
        // Following the pointer while dragging must not lag behind an animation
        !dragging() && resizing,
      )}
    >
      <div class={fullHeight} inert={!props.shown} style={{ width: `${shownWidth()}px` }}>
        {props.children}
      </div>
      <Show when={!props.shown ? props.rail : undefined}>
        {(rail) => (
          <div class={cx(railBase, props.side === "start" ? railAtStart : railAtEnd)}>
            <IconButton
              label={rail().label}
              size="icon-2xs"
              class={quietButton}
              onClick={rail().onExpand}
            >
              <ChevronRight class={cx(rtlFlip, props.side === "end" && rotate180)} />
            </IconButton>
          </div>
        )}
      </Show>
      <Show when={props.shown}>
        <div
          role="separator"
          aria-label={props.label}
          aria-orientation="vertical"
          aria-valuenow={shownWidth()}
          aria-valuemin={SIDEBAR_WIDTH.min}
          aria-valuemax={SIDEBAR_WIDTH.max}
          tabindex="0"
          class={cx(
            handle,
            props.side === "start" ? handleAtStart : handleAtEnd,
            dragging() && handleDragging,
          )}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }}
          onPointerMove={(event) => dragging() && resize(fromEdge(event.clientX))}
          onLostPointerCapture={() => setDragging(false)}
          onDblClick={() => resize(SIDEBAR_WIDTH.initial)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            // The handle moves towards the window edge on its right or its left
            const grows = ((event.key === "ArrowRight") === (props.side === "start")) !== isRtl();
            resize(shownWidth() + (grows ? KEYBOARD_STEP : -KEYBOARD_STEP));
          }}
        />
      </Show>
    </div>
  );
};

const SidebarFrame: Component<{
  class?: string | undefined;
  children: JSX.Element;
}> = (props) => <aside class={cx(frame, props.class)}>{props.children}</aside>;

/** Keeps the sidebars of an immersive window open while the user writes. Quiet until it is hovered or on. */
const PinButton: Component<{ pinned: boolean; onChange: (pinned: boolean) => void }> = (props) => (
  <ToggleIconButton
    pressed={props.pinned}
    onChange={props.onChange}
    label={t().settings.pinSidebars}
    size="icon-2xs"
    class={quietButton}
  >
    <Pin class={props.pinned ? "" : rotated} />
  </ToggleIconButton>
);

/**
 * Collapses the sidebar of a classic window, or brings it back. The chevron points the way the
 * sidebar goes: at the window edge while it is open, back into the window while it is folded away.
 */
const CollapseButton: Component<{
  side: SidebarSide;
  collapsed: boolean;
  onChange: (collapsed: boolean) => void;
}> = (props) => (
  <ToggleIconButton
    pressed={props.collapsed}
    onChange={props.onChange}
    label={props.collapsed ? t().sidebar.expandSidebar : t().sidebar.collapseSidebar}
    size="icon-2xs"
    class={quietButton}
  >
    <ChevronRight class={cx(rtlFlip, (props.side === "start") !== props.collapsed && rotate180)} />
  </ToggleIconButton>
);

/** The button that pins a sidebar open, or collapses it in a classic window. */
const ControlButton: Component<{ side: SidebarSide; control: SidebarControl }> = (props) => (
  <Show
    when={props.control.button() === "pin"}
    fallback={
      <CollapseButton
        side={props.side}
        collapsed={!props.control.open()}
        onChange={(collapsed) => props.control.setOpen(!collapsed)}
      />
    }
  >
    <PinButton pinned={props.control.open()} onChange={props.control.setOpen} />
  </Show>
);

interface ControlProps {
  control?: SidebarControl | undefined;
}

const SidebarTitle: Component<
  {
    title: string;
    /** A control that belongs to the name itself, such as the folder's parent button. */
    titleAction?: JSX.Element;
    /** A control at the far end of the row, such as the folder's sort menu. */
    action?: JSX.Element;
    side: SidebarSide;
  } & ControlProps
> = (props) => (
  <div class={titleRow}>
    <div class={titleMain}>
      <div dir="auto" class={titleText} title={props.title}>
        {props.title}
      </div>
      {props.titleAction}
    </div>
    {props.action}
    <Show when={props.control}>
      {(control) => <ControlButton side={props.side} control={control()} />}
    </Show>
  </div>
);

/** A sidebar that holds one list, such as the outline or a folder, under its title. */
export const SidebarPanel: Component<
  {
    side: SidebarSide;
    title: string;
    /** A control that belongs to the name itself, such as the folder's parent button. */
    titleAction?: JSX.Element;
    /** A control at the far end of the row, such as the sort menu of the folder. */
    action?: JSX.Element;
    class?: string | undefined;
    children: JSX.Element;
  } & ControlProps
> = (props) => (
  <SidebarFrame class={props.class}>
    <SidebarTitle
      title={props.title}
      titleAction={props.titleAction}
      action={props.action}
      side={props.side}
      control={props.control}
    />
    <ScrollView class={grow}>{props.children}</ScrollView>
  </SidebarFrame>
);

interface SidebarProps extends ControlProps {
  mode: SidebarMode;
  /** Which modes can be shown now; the switch appears only when both can. */
  hasOutline: boolean;
  hasFolder: boolean;
  /** Name of the folder shown in folder mode. */
  folderName: string;
  /** A control that belongs to the folder name, such as its parent button. */
  folderTitleAction?: JSX.Element;
  /** A control at the far end of the folder title, such as the sort menu. */
  folderAction?: JSX.Element;
  onModeChange: (mode: SidebarMode) => void;
  outline: JSX.Element;
  folder: JSX.Element;
  class?: string | undefined;
}

/** One sidebar with the outline and the folder as tabs, for the combined layout. */
export const Sidebar: Component<SidebarProps> = (props) => {
  const both = () => props.hasOutline && props.hasFolder;
  return (
    <SidebarFrame class={props.class}>
      <Show when={both() || props.control}>
        <div class={modeRow}>
          <Show when={both()}>
            <SegmentedControl<SidebarMode>
              class={grow}
              value={props.mode}
              onChange={props.onModeChange}
              options={[
                { value: "outline", label: t().sidebar.outline, icon: <ListTree /> },
                { value: "folder", label: t().sidebar.folder, icon: <Folder /> },
              ]}
            />
          </Show>
          <Show when={props.control}>
            {(control) => <ControlButton side="start" control={control()} />}
          </Show>
        </div>
      </Show>
      <Show when={props.mode === "folder"}>
        <SidebarTitle
          title={props.folderName}
          titleAction={props.folderTitleAction}
          action={props.folderAction}
          side="start"
        />
      </Show>
      {/* Both stay mounted so the expanded folders survive a switch to the outline */}
      <ScrollView class={cx(grow, props.mode !== "outline" && hidden)}>{props.outline}</ScrollView>
      <ScrollView class={cx(grow, props.mode !== "folder" && hidden)}>{props.folder}</ScrollView>
    </SidebarFrame>
  );
};
