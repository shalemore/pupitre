import { EditorView } from "@codemirror/view";
import { motionEnabled } from "@/lib/motion";

/**
 * Puts the line at `pos` at the top of the document. The editor scrolls inside the ScrollView
 * around it, so its scroll position is set there; the move animates when the settings ask for it.
 */
export function scrollToDocument(view: EditorView, pos: number): void {
  const scroller = view.dom.closest<HTMLElement>("[data-scroll-view]");
  if (scroller === null) {
    view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: "start" }) });
    return;
  }
  const top = view.lineBlockAt(pos).top;
  if (motionEnabled()) scroller.scrollTo({ top, behavior: "smooth" });
  else scroller.scrollTop = top;
}
