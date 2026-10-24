import { createEffect, createSignal } from "solid-js";
import { desktop, isMacOS } from "@/lib/desktop";

/** Distance from the top and the side edges of the window at which hidden chrome comes back. */
const TOP_EDGE = 48;
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
 */
export function createImmersiveChrome(canFold: () => boolean, sidebarsPinned: () => boolean) {
  const [writing, setWriting] = createSignal(false);
  const [nearTop, setNearTop] = createSignal(false);
  const [nearStart, setNearStart] = createSignal(false);
  const [nearEnd, setNearEnd] = createSignal(false);

  const shown = (nearEdge: boolean) => !canFold() || !writing() || nearEdge;
  const titleBarVisible = () => shown(nearTop());
  const sidebarVisible = () => sidebarsPinned() || shown(nearStart());
  const endSidebarVisible = () => sidebarsPinned() || shown(nearEnd());

  // The traffic lights belong to the title bar
  if (isMacOS) {
    createEffect(() => void desktop.invoke("window:set-buttons-visible", titleBarVisible()));
  }

  return {
    titleBarVisible,
    sidebarVisible,
    endSidebarVisible,
    /** Typing or scrolling in the document; the pointer has to move again to bring the chrome back. */
    hide: () => {
      setWriting(canFold());
      setNearTop(false);
      setNearStart(false);
      setNearEnd(false);
    },
    /** A new document starts with the chrome visible. */
    reset: () => setWriting(false),
    onPointerMove: (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      const fromStart = document.dir === "rtl" ? window.innerWidth - event.clientX : event.clientX;
      const fromEnd = window.innerWidth - fromStart;
      setNearTop(event.clientY < TOP_EDGE || event.target.closest(".app-title-bar") !== null);
      setNearStart(
        fromStart < SIDE_EDGE || event.target.closest('[data-sidebar="start"]') !== null,
      );
      setNearEnd(fromEnd < SIDE_EDGE || event.target.closest('[data-sidebar="end"]') !== null);
    },
  };
}
