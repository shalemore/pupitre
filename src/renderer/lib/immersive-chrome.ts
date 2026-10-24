import { createEffect, createSignal } from "solid-js";
import { desktop, isMacOS } from "@/lib/desktop";

/** Distance from the top and the side edges of the window at which hidden chrome comes back. */
const TOP_EDGE = 48;
/** Over a sidebar only this thin strip brings the title bar back, which would push the sidebar's own controls away from the pointer. */
const TOP_EDGE_OVER_SIDEBAR = 6;
/**
 * Scrolling the document folds the chrome; it comes back when the user pulls: pushes up again at
 * the top of the document, in a new gesture and not as the tail of the scroll that arrived there.
 * A gesture is new after this long without wheel events, and the pull is this many wheel pixels.
 */
const GESTURE_GAP = 300;
const PULL_DISTANCE = 80;
const SIDE_EDGE = 16;

/**
 * The title bar and the sidebars of an immersive window: they fold away once the user types or
 * scrolls in the document, so the document card takes their room, and unfold again while the
 * pointer is at the top or at the edge of the window they belong to (or over them). `canFold` tells whether
 * the window may fold them at all: not in a classic window, nor without a document. Pinned
 * sidebars stay.
 *
 * Leaving the page is deliberately not treated as leaving the edge: the title bar is a drag
 * region, which the page never sees the pointer over, so a "pointer left" event fires as soon as
 * the pointer reaches the title bar and would fold it again under the pointer.
 *
 * `titleBarPinned` keeps the title bar out while something in it is in use past the top of the
 * window, such as an open menu: its panel hangs below the bar, where the pointer is already too far
 * down to count as near the top, so the bar would fold away under it.
 */
export function createImmersiveChrome(
  canFold: () => boolean,
  sidebarsPinned: () => boolean,
  titleBarPinned: () => boolean,
) {
  const [writing, setWriting] = createSignal(false);
  const [nearTop, setNearTop] = createSignal(false);
  const [nearStart, setNearStart] = createSignal(false);
  const [nearEnd, setNearEnd] = createSignal(false);
  let lastWheelAt = 0;
  let pulling = false;
  let pulled = 0;

  const shown = (nearEdge: boolean) => !canFold() || !writing() || nearEdge;
  const titleBarVisible = () => titleBarPinned() || shown(nearTop());
  const sidebarVisible = () => sidebarsPinned() || shown(nearStart());
  const endSidebarVisible = () => sidebarsPinned() || shown(nearEnd());

  // The traffic lights belong to the title bar
  if (isMacOS) {
    createEffect(() => void desktop.invoke("window:set-buttons-visible", titleBarVisible()));
  }

  const hide = () => {
    setWriting(canFold());
    setNearTop(false);
    setNearStart(false);
    setNearEnd(false);
  };

  return {
    titleBarVisible,
    sidebarVisible,
    endSidebarVisible,
    /** Typing or scrolling in the document; the pointer has to move again to bring the chrome back. */
    hide,
    /** A new document starts with the chrome visible. */
    reset: () => setWriting(false),
    /** Scrolling the document folds the chrome, unless it is a pull at the top, which brings it back. */
    onWheel: (event: WheelEvent) => {
      if (!(event.target instanceof Element) || event.target.closest("[data-sidebar]")) return;
      const atTop = (event.target.closest(".overflow-y-auto")?.scrollTop ?? 0) <= 0;
      const up = event.deltaY < 0;
      if (event.timeStamp - lastWheelAt > GESTURE_GAP) {
        pulling = atTop && up;
        pulled = 0;
      } else if (!atTop || !up) {
        pulling = false;
      }
      lastWheelAt = event.timeStamp;
      if (!pulling) return hide();
      pulled -= event.deltaY;
      if (pulled >= PULL_DISTANCE) setWriting(false);
    },
    onPointerMove: (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      const fromStart = document.dir === "rtl" ? window.innerWidth - event.clientX : event.clientX;
      const fromEnd = window.innerWidth - fromStart;
      const overSidebar = event.target.closest("[data-sidebar]") !== null;
      setNearTop(
        event.clientY < (overSidebar ? TOP_EDGE_OVER_SIDEBAR : TOP_EDGE) ||
          event.target.closest(".app-title-bar") !== null,
      );
      setNearStart(
        fromStart < SIDE_EDGE || event.target.closest('[data-sidebar="start"]') !== null,
      );
      setNearEnd(fromEnd < SIDE_EDGE || event.target.closest('[data-sidebar="end"]') !== null);
    },
  };
}
