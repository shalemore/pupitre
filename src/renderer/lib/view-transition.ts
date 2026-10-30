import { untrack } from "solid-js";
import { motionEnabled } from "./motion";

/** A transition does not nest, so a second one started while the first runs would be dropped. */
let running = false;

/**
 * Runs a DOM update as a view transition: the browser paints the window as it was, the update
 * changes the live DOM at once, and the two images cross-fade. CodeMirror measures that live DOM
 * and never sees the animation, so a swap that reflows every line (another document taking the
 * editor's place, the source mode taking over) can arrive smoothly instead of flashing.
 *
 * The update is synchronous, as it would be without a transition: the old image is taken inside
 * `startViewTransition`, before the update runs, and the new one a frame later.
 */
export function withViewTransition(update: () => void): void {
  const doc = window.document;
  // Checked before the motion setting is read: a page without the API (jsdom, another browser)
  // must not pay for it, and does the update directly
  if (running || typeof doc.startViewTransition !== "function" || !untrack(motionEnabled)) {
    update();
    return;
  }
  let transition: ViewTransition | undefined;
  try {
    transition = doc.startViewTransition();
  } catch {
    // A document the browser cannot paint (it is being torn down) simply takes the update
  }
  if (transition === undefined) {
    update();
    return;
  }
  running = true;
  const settle = () => {
    running = false;
  };
  try {
    update();
  } finally {
    void transition.finished.then(settle, settle);
  }
}
