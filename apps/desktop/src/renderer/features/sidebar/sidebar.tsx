import { t } from "@pupitre/i18n/solid";
import { cn, IconButton, ScrollView, SegmentedControl, ToggleIconButton } from "@pupitre/ui";
import type { JSX } from "@solidjs/web";
import { ChevronRight, Folder, ListTree, Pin } from "lucide-solid";
import { createSignal, type Component, Show } from "solid-js";
import { distanceFromEnd, distanceFromStart, isRtl } from "@/lib/rtl";
import { SIDEBAR_WIDTH, type SidebarSide } from "@/lib/sidebar";
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
      class={cn(
        "relative shrink-0 overflow-hidden print:hidden",
        // Following the pointer while dragging must not lag behind an animation
        !dragging() && "transition-[width] duration-sheet ease-out-expo",
      )}
    >
      <div class="h-full" inert={!props.shown} style={{ width: `${shownWidth()}px` }}>
        {props.children}
      </div>
      <Show when={!props.shown ? props.rail : undefined}>
        {(rail) => (
          <div
            class={cn(
              "absolute inset-0 flex items-center justify-center bg-surface-0",
              props.side === "start"
                ? "border-e-hairline border-border"
                : "border-s-hairline border-border",
            )}
          >
            <IconButton
              label={rail().label}
              variant="quiet"
              size="icon-2xs"
              onClick={() => rail().onExpand()}
            >
              <ChevronRight class={cn("rtl:-scale-x-100", props.side === "end" && "rotate-180")} />
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
          class={cn(
            "__INTERACTIVE__ absolute inset-y-0 z-10 w-1 cursor-col-resize border-solid border-transparent outline-none hover:border-brand/30 focus-visible:border-brand/30",
            props.side === "start" ? "inset-e-0 border-e-hairline" : "inset-s-0 border-s-hairline",
            dragging() && "border-brand/40",
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
}> = (props) => (
  <aside
    class={cn(
      "flex size-full shrink-0 flex-col bg-surface-0 text-xs select-none print:hidden",
      props.class,
    )}
  >
    {props.children}
  </aside>
);

/** Keeps the sidebars of an immersive window open while the user writes. Quiet until it is hovered or on. */
const PinButton: Component<{ pinned: boolean; onChange: (pinned: boolean) => void }> = (props) => (
  <ToggleIconButton
    pressed={props.pinned}
    onChange={props.onChange}
    label={t().settings.pinSidebars}
    variant="quiet"
    size="icon-2xs"
  >
    <Pin class={props.pinned ? "" : "rotate-45"} />
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
    variant="quiet"
    size="icon-2xs"
  >
    <ChevronRight
      class={cn("rtl:-scale-x-100", (props.side === "start") !== props.collapsed && "rotate-180")}
    />
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
    /** A control at the far end of the row, such as the folder's sort menu. */
    action?: JSX.Element;
    side: SidebarSide;
  } & ControlProps
> = (props) => (
  <div class="flex items-center gap-1 ps-4 pe-2 pt-2">
    <div class="flex min-w-0 flex-1 items-center gap-1">
      <div
        dir="auto"
        class="min-w-0 truncate text-2xs font-medium text-muted-foreground"
        title={props.title}
      >
        {props.title}
      </div>
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
    /** A control at the far end of the row, such as the sort menu of the folder. */
    action?: JSX.Element;
    class?: string | undefined;
    children: JSX.Element;
  } & ControlProps
> = (props) => (
  <SidebarFrame class={props.class}>
    <SidebarTitle
      title={props.title}
      action={props.action}
      side={props.side}
      control={props.control}
    />
    <ScrollView class="min-w-0 flex-1">{props.children}</ScrollView>
  </SidebarFrame>
);

interface SidebarProps extends ControlProps {
  mode: SidebarMode;
  /** Which modes can be shown now; the switch appears only when both can. */
  hasOutline: boolean;
  hasFolder: boolean;
  /** Name of the folder shown in folder mode. */
  folderName: string;
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
        <div class="m-2 mb-0 flex items-center justify-end gap-1">
          <Show when={both()}>
            <SegmentedControl<SidebarMode>
              class="min-w-0 flex-1"
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
        <SidebarTitle title={props.folderName} action={props.folderAction} side="start" />
      </Show>
      {/* Both stay mounted so the expanded folders survive a switch to the outline */}
      <ScrollView class={cn("min-w-0 flex-1", props.mode !== "outline" && "hidden")}>
        {props.outline}
      </ScrollView>
      <ScrollView class={cn("min-w-0 flex-1", props.mode !== "folder" && "hidden")}>
        {props.folder}
      </ScrollView>
    </SidebarFrame>
  );
};
