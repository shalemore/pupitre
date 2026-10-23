import { createEffect, createSignal } from "solid-js";
import { desktop, isMacOS } from "@/lib/desktop";

/** Distance from the top and the start edge of the window at which hidden chrome comes back. */
const TOP_EDGE = 48;
const START_EDGE = 16;

/**
 * The title bar and the sidebar of an immersive window: they get out of the way once the user
 * types or scrolls in the document, and come back while the pointer is at the top or the start
 * edge of the window (or over them). Without a document, or in a classic window, they stay.
 */
export function createImmersiveChrome(options: { enabled: boolean; hasDocument: () => boolean }) {
  const [writing, setWriting] = createSignal(false);
  const [nearTop, setNearTop] = createSignal(false);
  const [nearStart, setNearStart] = createSignal(false);

  const shown = (nearEdge: boolean) =>
    !options.enabled || !options.hasDocument() || !writing() || nearEdge;
  const titleBarVisible = () => shown(nearTop());
  const sidebarVisible = () => shown(nearStart());
  /** The sidebar takes up room only until writing starts; after that it overlays the text. */
  const sidebarDocked = () => shown(false);

  if (options.enabled && isMacOS) {
    createEffect(() => void desktop.invoke("window:set-buttons-visible", titleBarVisible()));
  }

  return {
    titleBarVisible,
    sidebarVisible,
    sidebarDocked,
    /** Typing or scrolling in the document. */
    hide: () => setWriting(options.enabled),
    /** A new document starts with the chrome visible. */
    reset: () => setWriting(false),
    onPointerMove: (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      const fromStart = document.dir === "rtl" ? window.innerWidth - event.clientX : event.clientX;
      setNearTop(event.clientY < TOP_EDGE || event.target.closest(".app-title-bar") !== null);
      setNearStart(fromStart < START_EDGE || event.target.closest("[data-sidebar]") !== null);
    },
    onPointerLeave: () => {
      setNearTop(false);
      setNearStart(false);
    },
  };
}
