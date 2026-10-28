import { EditorView } from "@codemirror/view";
import { motionEnabled, scrollTiming } from "@/lib/motion";

let frame: number | undefined;
let stopListening: (() => void) | undefined;

function cancel(): void {
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = undefined;
  stopListening?.();
  stopListening = undefined;
}

/** The line at `pos`, once CodeMirror has rendered it. */
function lineElement(view: EditorView, pos: number): HTMLElement | undefined {
  const { node } = view.domAtPos(pos);
  const element = node instanceof Element ? node : node.parentElement;
  return element?.closest<HTMLElement>(".cm-line") ?? undefined;
}

/** The top the line should sit at, exact once its element is rendered. */
function lineTop(view: EditorView, scroller: HTMLElement, pos: number): number {
  const rect = lineElement(view, pos)?.getBoundingClientRect();
  if (rect === undefined || rect.height === 0) return view.lineBlockAt(pos).top;
  return scroller.scrollTop + rect.top - scroller.getBoundingClientRect().top;
}

/**
 * Puts the line at `pos` at the top of the document, moving with the duration and curve the theme
 * gives. CodeMirror measures the lines a move brings in while it runs, so the place it can aim at
 * at first is only an estimate; the last frames aim again and the move settles on the line itself.
 */
export function scrollToDocument(view: EditorView, pos: number): void {
  const scroller = view.dom.closest<HTMLElement>("[data-scroll-view]");
  if (scroller === null) {
    view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: "start" }) });
    return;
  }
  cancel();

  const settle = (attempt: number) => {
    frame = requestAnimationFrame(() => {
      frame = undefined;
      const rect = lineElement(view, pos)?.getBoundingClientRect();
      if (rect === undefined || rect.height === 0) {
        // The line is still outside the rendered range; move to the estimate and measure again
        if (attempt < 3) {
          scroller.scrollTop = view.lineBlockAt(pos).top;
          settle(attempt + 1);
        }
        return;
      }
      const exact = scroller.scrollTop + rect.top - scroller.getBoundingClientRect().top;
      if (Math.abs(scroller.scrollTop - exact) > 1) scroller.scrollTop = exact;
    });
  };

  if (!motionEnabled()) {
    scroller.scrollTop = view.lineBlockAt(pos).top;
    settle(0);
    return;
  }

  const { duration, ease } = scrollTiming();
  const start = scroller.scrollTop;
  const started = performance.now();
  // The pointer takes the scroll back over the moment it moves the page
  const stop = () => cancel();
  scroller.addEventListener("wheel", stop, { passive: true });
  scroller.addEventListener("touchstart", stop, { passive: true });
  stopListening = () => {
    scroller.removeEventListener("wheel", stop);
    scroller.removeEventListener("touchstart", stop);
  };

  const step = (now: number) => {
    frame = undefined;
    const target = lineTop(view, scroller, pos);
    const progress = Math.min(1, (now - started) / duration);
    scroller.scrollTop = start + (target - start) * ease(progress);
    if (progress < 1) {
      frame = requestAnimationFrame(step);
      return;
    }
    stopListening?.();
    stopListening = undefined;
    settle(0);
  };
  frame = requestAnimationFrame(step);
}
