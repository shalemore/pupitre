import { makeEventListener } from "@solid-primitives/event-listener";
import { createEffect, createSignal } from "solid-js";
import { TITLE_BAR_HEIGHT } from "@shared/desktop-api";
import { desktop, isMacOS } from "@/lib/desktop";

/** A little past the title bar, so a pointer on the bar always counts as near the top. */
const TOP_EDGE = TITLE_BAR_HEIGHT + 8;
const SIDE_EDGE = 16;
/** Over a sidebar the title bar would push the sidebar's own controls under the pointer. */
const TOP_EDGE_OVER_SIDEBAR = 6;
/** What one notch of a mouse wheel scrolls in Chrome, which is what a push counts. */
const WHEEL_CLICK = 100;
/** Two clicks, so reaching the top of the document and nudging once never unfolds the chrome. */
const PULL_DISTANCE = WHEEL_CLICK * 2;
/** A pause this long ends a push, so nudges at the top add up only while they go on. */
const PULL_PAUSE = 700;
/** Room the document keeps beside the sidebars: a narrower one wraps so hard it stops reading. */
const DOCUMENT_MIN_WIDTH = 560;

const NO_EDGE = { top: false, start: false, end: false };

/**
 * The chrome of an immersive window folds away while the user works in the document, and comes back
 * only when they ask for it: the pointer entering its edge, or a push up at the top of the document.
 *
 * `titleBarPinned` keeps the title bar out while something in it, such as an open menu, is in use
 * past the top of the window: its panel hangs where the pointer no longer counts as near the top.
 * Leaving the page is not treated as leaving an edge, because the title bar is a drag region the
 * page never sees the pointer over, so a "pointer left" event fires as soon as the pointer reaches
 * it.
 */
export interface ChromeOptions {
  canFold: () => boolean;
  startPinned: () => boolean;
  endPinned: () => boolean;
  titleBarPinned: () => boolean;
  /** Width a sidebar takes beside the document; 0 when the layout shows none. */
  startRoom: () => number;
  endRoom: () => number;
}

export function createImmersiveChrome(options: ChromeOptions) {
  const [writing, setWriting] = createSignal(false);
  const [near, setNear] = createSignal(NO_EDGE);
  // A control the user just used may leave the pointer past the edge it belongs to, such as a menu
  // item that hangs below the title bar; the chrome stays unfolded until the user goes back to
  // writing or scrolling, rather than folding as soon as the pointer moves back into the text
  const [kept, setKept] = createSignal(false);
  const [viewport, setViewport] = createSignal(window.innerWidth);
  makeEventListener(window, "resize", () => setViewport(window.innerWidth));
  let pushed = 0;
  let lastWheelAt = 0;

  const cramped = (room: number) => viewport() < room + DOCUMENT_MIN_WIDTH;
  const endFolded = () => !options.endPinned() && cramped(options.startRoom() + options.endRoom());
  const startFolded = () =>
    !options.startPinned() && cramped(options.startRoom() + (endFolded() ? 0 : options.endRoom()));
  const shown = (atEdge: boolean, folded = false) =>
    !options.canFold() || kept() || atEdge || (!writing() && !folded);
  const titleBarVisible = () => options.titleBarPinned() || shown(near().top);
  const sidebarVisible = () => options.startPinned() || shown(near().start, startFolded());
  const endSidebarVisible = () => options.endPinned() || shown(near().end, endFolded());

  // The traffic lights belong to the title bar
  if (isMacOS) {
    createEffect(() => void desktop.invoke("window:set-buttons-visible", titleBarVisible()));
  }

  const hide = () => {
    setWriting(options.canFold());
    setKept(false);
    setNear(NO_EDGE);
  };
  const show = () => setWriting(false);

  return {
    titleBarVisible,
    sidebarVisible,
    endSidebarVisible,
    hide,
    show,
    /** Keeps the chrome unfolded until the user writes or scrolls, for a pick made in it. */
    keepVisible: () => setKept(true),
    onWheel: (event: WheelEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      // A sidebar scrolls on its own; folding the chrome under a pointer that reads it would move the list
      if (target?.closest("[data-sidebar]")) return;
      const port = target?.closest<HTMLElement>("[data-scroll-view]");
      const pushing = event.deltaY < 0 && port != null && port.scrollTop <= 0;
      if (!pushing) {
        pushed = 0;
        return hide();
      }
      const restart = event.timeStamp - lastWheelAt > PULL_PAUSE;
      lastWheelAt = event.timeStamp;
      pushed = (restart ? 0 : pushed) - event.deltaY;
      if (pushed >= PULL_DISTANCE) show();
    },
    onPointerMove: (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      const fromStart = document.dir === "rtl" ? window.innerWidth - event.clientX : event.clientX;
      const sidebar = event.target.closest("[data-sidebar]")?.getAttribute("data-sidebar");
      setNear({
        top: event.clientY < (sidebar ? TOP_EDGE_OVER_SIDEBAR : TOP_EDGE),
        start: fromStart < SIDE_EDGE || sidebar === "start",
        end: window.innerWidth - fromStart < SIDE_EDGE || sidebar === "end",
      });
    },
  };
}
