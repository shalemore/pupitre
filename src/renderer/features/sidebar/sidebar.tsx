import { ChevronRight, Folder, ListTree, Pin } from "lucide-solid";
import { createSignal, type Component, type JSX, Show } from "solid-js";
import { ScrollView, SegmentedControl, ToggleIconButton } from "@/components/ui";
import { t } from "@/i18n";
import { distanceFromEnd, distanceFromStart, isRtl } from "@/lib/rtl";
import { quietButton, rtlFlip } from "@/lib/styles";
import { css, cx } from "@/styled-system/css";

export type SidebarMode = "outline" | "folder";

/** The window edge a sidebar sits at; the immersive window folds each one towards its own edge. */
export type SidebarSide = "start" | "end";

export const SIDEBAR_WIDTH = { initial: 256, min: 180, max: 480 };
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
  width: "1px",
  cursor: "col-resize",
  outlineStyle: "none",
  _hover: { backgroundColor: "brand/30" },
  _focusVisible: { backgroundColor: "brand/30" },
});
const handleAtStart = css({ insetInlineEnd: "0" });
const handleAtEnd = css({ insetInlineStart: "0" });
const handleDragging = css({ backgroundColor: "brand/40" });
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
const rotated = css({ rotate: "45deg" });
const rotate180 = css({ rotate: "180deg" });
const titleRow = css({
  display: "flex",
  alignItems: "center",
  gap: "1",
  paddingInlineStart: "4",
  paddingInlineEnd: "2",
  paddingBlockStart: "2",
});
const titleMain = css({ display: "flex", minWidth: 0, flex: "1", alignItems: "center", gap: "1" });
const titleText = css({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textStyle: "2xs",
  fontWeight: "medium",
  color: "muted.foreground",
});
const modeRow = css({
  margin: "2",
  marginBlockEnd: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "1",
});
const grow = css({ minWidth: 0, flex: "1" });
const hidden = css({ display: "none" });

interface SidebarSlotProps {
  side: SidebarSide;
  shown: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  children: JSX.Element;
}

/**
 * Where a sidebar sits next to the document. Collapsing animates the width and the document
 * takes the freed room; inert keeps a hidden sidebar out of the tab order. The edge towards the
 * document is a handle that resizes the sidebar by dragging or with the arrow keys; double-click
 * restores the initial width.
 */
export const SidebarSlot: Component<SidebarSlotProps> = (props) => {
  const [dragging, setDragging] = createSignal(false);
  const resize = (width: number) =>
    props.onWidthChange(Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, width)));
  /** How far the pointer is from the window edge this sidebar sits at. */
  const fromEdge = (clientX: number) =>
    props.side === "start" ? distanceFromStart(clientX) : distanceFromEnd(clientX);

  return (
    <div
      // The resize handle belongs to the sidebar as far as the immersive window's hover goes
      data-sidebar={props.side}
      inert={!props.shown}
      style={{ width: props.shown ? `${props.width}px` : "0px" }}
      class={cx(
        slot,
        // Following the pointer while dragging must not lag behind an animation
        !dragging() && resizing,
      )}
    >
      <div class={fullHeight} style={{ width: `${props.width}px` }}>
        {props.children}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={props.width}
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
          resize(props.width + (grows ? KEYBOARD_STEP : -KEYBOARD_STEP));
        }}
      />
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

interface PinProps {
  /**
   * The stored pin value. An immersive window keeps the sidebar open while it is set; a classic
   * window, where the same value is reused, keeps the sidebar collapsed instead.
   */
  pinned: boolean;
  onPinnedChange?: ((pinned: boolean) => void) | undefined;
  /** Whether the button collapses the sidebar rather than pinning it, as a classic window does. */
  collapsing?: boolean | undefined;
}

const SidebarTitle: Component<
  {
    title: string;
    /** A control that belongs to the name itself, such as the folder's parent button. */
    titleAction?: JSX.Element;
    /** A control at the far end of the row, such as the folder's sort menu. */
    action?: JSX.Element;
    side: SidebarSide;
  } & PinProps
> = (props) => (
  <div class={titleRow}>
    <div class={titleMain}>
      <div dir="auto" class={titleText} title={props.title}>
        {props.title}
      </div>
      {props.titleAction}
    </div>
    {props.action}
    <Show when={props.onPinnedChange}>
      {(onChange) =>
        props.collapsing ? (
          <CollapseButton side={props.side} collapsed={props.pinned} onChange={onChange()} />
        ) : (
          <PinButton pinned={props.pinned} onChange={onChange()} />
        )
      }
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
  } & PinProps
> = (props) => (
  <SidebarFrame class={props.class}>
    <SidebarTitle
      title={props.title}
      titleAction={props.titleAction}
      action={props.action}
      side={props.side}
      pinned={props.pinned}
      onPinnedChange={props.onPinnedChange}
      collapsing={props.collapsing}
    />
    <ScrollView class={grow}>{props.children}</ScrollView>
  </SidebarFrame>
);

interface SidebarProps extends PinProps {
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
      <Show when={both() || props.onPinnedChange}>
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
          <Show when={props.onPinnedChange}>
            {(onChange) =>
              props.collapsing ? (
                <CollapseButton side="start" collapsed={props.pinned} onChange={onChange()} />
              ) : (
                <PinButton pinned={props.pinned} onChange={onChange()} />
              )
            }
          </Show>
        </div>
      </Show>
      <Show when={props.mode === "folder"}>
        <SidebarTitle
          title={props.folderName}
          titleAction={props.folderTitleAction}
          action={props.folderAction}
          side="start"
          pinned={props.pinned}
        />
      </Show>
      {/* Both stay mounted so the expanded folders survive a switch to the outline */}
      <ScrollView class={cx(grow, props.mode !== "outline" && hidden)}>{props.outline}</ScrollView>
      <ScrollView class={cx(grow, props.mode !== "folder" && hidden)}>{props.folder}</ScrollView>
    </SidebarFrame>
  );
};
