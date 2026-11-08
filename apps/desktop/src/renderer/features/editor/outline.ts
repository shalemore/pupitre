import type { ChangeDesc, EditorState } from "@codemirror/state";
import { debounce } from "@solid-primitives/scheduled";
import {
  canShiftHeadings,
  collectHeadings,
  type HeadingUpdate,
  mergeHeadings,
  type OutlineHeading,
} from "@/lib/markdown/structure";

const OUTLINE_DEBOUNCE_MS = 150;

/**
 * The headings of the document as it is edited. Collecting them walks the parsed tree, so the
 * keystrokes settle first; an edit that touches no heading only shifts the positions of the ones
 * below it, rather than rebuilding the whole outline.
 */
export function createOutlineTracker(notify: (headings: OutlineHeading[]) => void) {
  let headings: OutlineHeading[] = [];
  let started = false;
  let observedDoc: EditorState["doc"] | undefined;
  let dirty = false;
  let pending: ChangeDesc | undefined;

  const updateOutline = debounce((state: EditorState) => {
    if (!dirty && pending !== undefined) {
      const changes = pending;
      pending = undefined;
      for (const heading of headings) {
        heading.pos = changes.mapPos(heading.pos);
      }
      return;
    }
    dirty = false;
    pending = undefined;
    const next = mergeHeadings(headings, collectHeadings(state));
    if (next === headings) return;
    headings = next;
    notify(headings);
  }, OUTLINE_DEBOUNCE_MS);

  return {
    current: () => headings,
    /**
     * Takes a document change and returns whether its text changed. The first tree is read as the
     * editor opens, so its rows are not assembled under the first keystrokes.
     */
    update: (state: EditorState, change: HeadingUpdate | undefined): boolean => {
      const docChanged = state.doc !== observedDoc;
      observedDoc = state.doc;
      if (!started) {
        started = true;
        headings = collectHeadings(state);
        notify(headings);
        return docChanged;
      }
      if (!docChanged || change === undefined || dirty || !canShiftHeadings(headings, change)) {
        dirty = true;
        pending = undefined;
      } else {
        pending =
          pending === undefined ? change.changes.desc : pending.composeDesc(change.changes.desc);
      }
      updateOutline(state);
      return docChanged;
    },
    dispose: () => updateOutline.clear(),
  };
}
