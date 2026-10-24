import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { Settings } from "@shared/settings";

/**
 * The shape and blinking of the caret. They are CSS (editor.css, keyed by these attributes) on the
 * browser's own caret, so a theme's `caret-color` and the native selection keep working.
 */
export function cursorStyle(
  shape: Settings["cursorShape"],
  blink: Settings["cursorBlink"],
): Extension {
  return EditorView.contentAttributes.of({
    "data-cursor-shape": shape,
    "data-cursor-blink": blink,
  });
}

/** The smooth blink starts from a solid caret after each edit or move, like the native one. */
export const restartCursorBlink = EditorView.updateListener.of((update) => {
  if (!update.selectionSet && !update.docChanged) return;
  for (const animation of update.view.contentDOM.getAnimations()) animation.currentTime = 0;
});
