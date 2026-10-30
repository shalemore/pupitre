import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { readDuration } from "@/lib/motion";

/**
 * Whether an editor's DOM is about to change because the text did, rather than because the view
 * scrolled or another document arrived. A block that leaves during an edit has a moment to fade
 * out where it stood; one that leaves with the viewport is simply gone, since a ghost at the edge
 * of the screen would only flash.
 */
const editing = new WeakMap<Element, boolean>();

/** A transaction that rewrites the whole document, such as opening a file or a tab. */
function replacesDocument(update: ViewUpdate): boolean {
  return update.transactions.some((transaction) => {
    let whole = false;
    transaction.changes.iterChangedRanges((fromA, toA) => {
      if (fromA === 0 && toA >= transaction.startState.doc.length) whole = true;
    });
    return whole;
  });
}

export const leavingBlocks = ViewPlugin.fromClass(
  class {
    readonly content: HTMLElement;

    constructor(view: EditorView) {
      this.content = view.contentDOM;
    }

    update(update: ViewUpdate): void {
      editing.set(this.content, update.docChanged && !replacesDocument(update));
    }

    /** The document view has been updated, and the blocks that left with it are gone. */
    docViewUpdate(): void {
      editing.set(this.content, false);
    }

    destroy(): void {
      // The view tears its plugins down before its content, so a closed window makes no ghosts
      editing.set(this.content, false);
    }
  },
);

/**
 * Sets a block's DOM aside to fade out over the text that replaced it. CodeMirror destroys a
 * widget while its element still stands in the document, which is the only moment its place is
 * known; the copy takes that place in the page itself, since the editor is about to measure its
 * content again and a node inside it would count.
 */
export function fadeOut(dom: HTMLElement): void {
  const content = dom.closest(".cm-content");
  if (!(content instanceof HTMLElement) || editing.get(content) !== true) return;
  const rect = dom.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
    return;
  }
  const ghost = dom.cloneNode(true);
  if (!(ghost instanceof HTMLElement)) return;
  // A copy of a live frame or a player would load again; the block's other content still fades
  for (const media of ghost.querySelectorAll("iframe, video, audio")) media.remove();
  const style = getComputedStyle(dom);
  ghost.classList.add("md-block-ghost");
  ghost.inert = true;
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.cssText = [
    "position: fixed",
    "margin: 0",
    "pointer-events: none",
    `left: ${rect.left}px`,
    `top: ${rect.top}px`,
    `width: ${rect.width}px`,
    `height: ${rect.height}px`,
    `font: ${style.font}`,
    `color: ${style.color}`,
    `direction: ${style.direction}`,
    `text-align: ${style.textAlign}`,
  ].join("; ");
  document.body.append(ghost);
  ghost.addEventListener("animationend", () => ghost.remove(), { once: true });
  // A theme may give the fade a length of its own, or turn it off through the motion switch and
  // leave no animation to end; the timeout is the way out either way
  const fade = readDuration(getComputedStyle(ghost).animationDuration, 500);
  window.setTimeout(() => ghost.remove(), fade + 200);
}
