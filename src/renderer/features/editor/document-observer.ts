import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Extension } from "@codemirror/state";
import { type EditorView, ViewPlugin } from "@codemirror/view";
import type { HeadingUpdate } from "@/lib/markdown/structure";

export interface DocumentObserver {
  onDocChange: (state: EditorState, update?: HeadingUpdate) => void;
  /**
   * Where the outline should point: the caret's line while it is on screen, otherwise the line a
   * quarter down the viewport, or the end of the document when it is scrolled to its foot.
   */
  onPositionChange: (position: number) => void;
}

/** How far down the viewport the eye reads while the caret is out of sight. */
const READING_LINE = 0.25;

function readingPosition(view: EditorView, scroller: HTMLElement): number {
  const { state } = view;
  const top = scroller.scrollTop;
  const height = scroller.clientHeight;
  const cursor = state.selection.main.head;
  const block = view.lineBlockAt(cursor);
  // The section being written in stays current while its line is on screen, even far down a page
  if (block.top < top + height && block.bottom > top) return cursor;
  // At the foot of the document the last section is the one being read, however short it is
  if (scroller.scrollHeight > height && top + height >= scroller.scrollHeight - 1) {
    return state.doc.length;
  }
  return view.lineBlockAtHeight(top + height * READING_LINE).from;
}

/**
 * Reports document changes and the position the outline follows (outline, word count, current
 * section). Long documents are parsed in the background, so a grown syntax tree counts as a change.
 * `scroller` is the element the editor is scrolled in, which is the view around it rather than the
 * one CodeMirror draws (see markdown-editor.tsx).
 */
export function documentObserver(observer: DocumentObserver, scroller: HTMLElement): Extension {
  return ViewPlugin.define((view) => {
    let frame: number | undefined;
    const report = () => {
      frame = undefined;
      observer.onPositionChange(readingPosition(view, scroller));
    };
    // Scrolling fires far more often than a frame; the outline only needs this frame's position
    const schedule = () => {
      if (frame === undefined) frame = requestAnimationFrame(report);
    };

    observer.onDocChange(view.state);
    report();
    scroller.addEventListener("scroll", schedule, { passive: true });
    return {
      update: (update) => {
        if (update.docChanged || syntaxTree(update.state) !== syntaxTree(update.startState)) {
          observer.onDocChange(update.state, update);
        }
        if (update.selectionSet || update.docChanged) schedule();
      },
      destroy: () => {
        scroller.removeEventListener("scroll", schedule);
        if (frame !== undefined) cancelAnimationFrame(frame);
      },
    };
  });
}
