import { Plugin } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";

/**
 * Writing modes, each a self-contained ProseMirror plugin switched on by a setting. A plugin reads
 * its switch through a getter; the editor dispatches an empty transaction when the setting
 * changes so the view picks it up.
 */

/**
 * Focus mode: every block except the one being written is dimmed. Only the current text block is
 * decorated; the dimming itself is CSS on text blocks (editor.css), so moving the cursor changes
 * one decoration instead of touching every block in the document.
 */
export function focusModePlugin(enabled: () => boolean): Plugin {
  return new Plugin({
    props: {
      attributes: (): Record<string, string> => (enabled() ? { class: "focus-mode" } : {}),
      decorations: ({ doc, selection }) => {
        const { $head } = selection;
        if (!enabled() || $head.depth === 0) return DecorationSet.empty;
        const block = $head.before($head.depth);
        const current = Decoration.node(block, block + $head.parent.nodeSize, {
          class: "is-current",
        });
        return DecorationSet.create(doc, [current]);
      },
    },
  });
}

function scrollContainer(element: HTMLElement): HTMLElement | undefined {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") return parent;
  }
  return undefined;
}

/** Scrolls so the line with the cursor sits in the middle of the editor. */
function centerCursor(view: EditorView): void {
  const container = scrollContainer(view.dom);
  if (!container) return;
  const caret = view.coordsAtPos(view.state.selection.head);
  const box = container.getBoundingClientRect();
  const offset = (caret.top + caret.bottom) / 2 - (box.top + box.height / 2);
  if (Math.abs(offset) > 1) container.scrollTop += offset;
}

/**
 * Typewriter mode: the line being written stays in the vertical middle of the window and the
 * text moves instead of the cursor. Extra space below the document (editor.css) lets the last
 * lines reach the middle too. Selections made with the mouse are left where they are, otherwise
 * the text would jump away from the pointer while dragging.
 */
export function typewriterModePlugin(enabled: () => boolean): Plugin {
  let usingPointer = false;
  return new Plugin({
    props: {
      attributes: (): Record<string, string> => (enabled() ? { class: "typewriter-mode" } : {}),
      handleDOMEvents: {
        mousedown: () => {
          usingPointer = true;
          return false;
        },
        keydown: () => {
          usingPointer = false;
          return false;
        },
      },
    },
    view: () => {
      let active = false;
      return {
        update: (view, previous) => {
          const wasActive = active;
          active = enabled() && view.hasFocus();
          if (!active) return;
          const typed = !view.state.doc.eq(previous.doc);
          const moved = !usingPointer && !view.state.selection.eq(previous.selection);
          if (!wasActive || typed || moved) centerCursor(view);
        },
      };
    },
  });
}
