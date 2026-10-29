import { cn } from "cn";
import { Folder, ListTree, Pin } from "lucide-solid";
import { createSignal, type Component, type JSX, Show } from "solid-js";
import { ScrollView, SegmentedControl, ToggleIconButton } from "@/components/ui";
import { t } from "@/i18n";
import { distanceFromEnd, distanceFromStart, isRtl } from "@/lib/rtl";

export type SidebarMode = "outline" | "folder";

/** The window edge a sidebar sits at; the immersive window folds each one towards its own edge. */
export type SidebarSide = "start" | "end";

export const SIDEBAR_WIDTH = { initial: 256, min: 180, max: 480 };
const KEYBOARD_STEP = 16;

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
      class={cn(
        "relative shrink-0 overflow-hidden print:hidden",
        // Following the pointer while dragging must not lag behind an animation
        !dragging() && "transition-[width] duration-sheet",
      )}
    >
      <div class="h-full" style={{ width: `${props.width}px` }}>
        {props.children}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={props.width}
        aria-valuemin={SIDEBAR_WIDTH.min}
        aria-valuemax={SIDEBAR_WIDTH.max}
        tabindex="0"
        class={cn(
          "absolute inset-y-0 z-10 w-1 cursor-col-resize outline-none transition-colors hover:bg-brand/30 focus-visible:bg-brand/30",
          props.side === "start" ? "inset-e-0" : "inset-s-0",
          dragging() && "bg-brand/40",
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
}> = (props) => (
  <aside
    class={cn(
      "flex print:hidden flex-col bg-surface-0 select-none shrink-0 text-xs size-full",
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
    size="icon-2xs"
    class="text-tertiary opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100 data-pressed:opacity-100"
  >
    <Pin class={cn(!props.pinned && "rotate-45")} />
  </ToggleIconButton>
);

interface PinProps {
  pinned: boolean;
  /** Only an immersive window folds its sidebars, so only there is there something to pin. */
  onPinnedChange?: ((pinned: boolean) => void) | undefined;
}

const SidebarTitle: Component<{ title: string; action?: JSX.Element } & PinProps> = (props) => (
  <div class="flex items-center gap-1 ps-4 pe-2 pt-2">
    <div
      dir="auto"
      class="min-w-0 flex-1 truncate text-2xs font-medium text-muted-foreground"
      title={props.title}
    >
      {props.title}
    </div>
    {props.action}
    <Show when={props.onPinnedChange}>
      {(onChange) => <PinButton pinned={props.pinned} onChange={onChange()} />}
    </Show>
  </div>
);

/** A sidebar that holds one list, such as the outline or a folder, under its title. */
export const SidebarPanel: Component<
  {
    side: SidebarSide;
    title: string;
    /** A control the title carries, such as the sort menu of the folder. */
    action?: JSX.Element;
    class?: string | undefined;
    children: JSX.Element;
  } & PinProps
> = (props) => (
  <SidebarFrame class={props.class}>
    <SidebarTitle
      title={props.title}
      action={props.action}
      pinned={props.pinned}
      onPinnedChange={props.onPinnedChange}
    />
    <ScrollView class="flex-1">{props.children}</ScrollView>
  </SidebarFrame>
);

interface SidebarProps extends PinProps {
  mode: SidebarMode;
  /** Which modes can be shown now; the switch appears only when both can. */
  hasOutline: boolean;
  hasFolder: boolean;
  /** Name of the folder shown in folder mode. */
  folderName: string;
  /** A control the folder title carries, such as the sort menu. */
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
          <Show when={props.onPinnedChange}>
            {(onChange) => <PinButton pinned={props.pinned} onChange={onChange()} />}
          </Show>
        </div>
      </Show>
      <Show when={props.mode === "folder"}>
        <SidebarTitle title={props.folderName} action={props.folderAction} pinned={props.pinned} />
      </Show>
      {/* Both stay mounted so the expanded folders survive a switch to the outline */}
      <ScrollView class={cn("flex-1", props.mode !== "outline" && "hidden")}>
        {props.outline}
      </ScrollView>
      <ScrollView class={cn("flex-1", props.mode !== "folder" && "hidden")}>
        {props.folder}
      </ScrollView>
    </SidebarFrame>
  );
};
