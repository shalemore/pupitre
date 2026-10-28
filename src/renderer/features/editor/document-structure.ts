import { syntaxTree } from "@codemirror/language";
import type { ChangeSet, EditorState, Extension } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";
import type { Tree } from "@lezer/common";
import type { OutlineHeading } from "./outline-heading";

export type { OutlineHeading } from "./outline-heading";

/** A heading's node name, whose last character is its level: ATXHeading2, SetextHeading1. */
export const HEADING_LEVEL = /^(?:ATX|Setext)Heading([1-6])$/;
const LEAF_BLOCK = /^(?:Paragraph|FencedCode|CodeBlock|HTMLBlock|Table|FrontMatter)$/;
const HTML_MARKUP = /<!--[^]*?-->|<[^>]*>/g;
/** Source that a reader never sees: link destinations, code languages, markup, front matter. */
const UNREAD_NODES = new Set([
  "FrontMatter",
  "LinkTitle",
  "LinkLabel",
  "LinkReference",
  "FootnoteLabel",
  "CodeInfo",
  "HTMLTag",
  "Comment",
  "ProcessingInstruction",
  "TableDelimiter",
  "TaskMarker",
]);

function isUnread(name: string, parent: string | undefined): boolean {
  if (name === "URL") return parent === "Link" || parent === "Image";
  return name.endsWith("Mark") || UNREAD_NODES.has(name);
}

/**
 * The text a reader sees between `from` and `to`: Markdown syntax, link destinations and front
 * matter are left out and raw HTML contributes the text between its tags, so markup does not count
 * as words or show up in the outline.
 */
export function readableTextFrom(
  tree: Tree,
  slice: (from: number, to: number) => string,
  from = 0,
  to = tree.length,
): string {
  let text = "";
  let pos = from;
  const skipTo = (start: number, end: number) => {
    if (start > pos) text += slice(pos, start);
    pos = Math.max(pos, end);
  };
  tree.iterate({
    from,
    to,
    enter: (node) => {
      const start = Math.max(node.from, from);
      const end = Math.min(node.to, to);
      if (node.name === "Escape") {
        skipTo(start, start + 1);
        return false;
      }
      if (node.name === "HTMLBlock" || node.name === "CommentBlock") {
        skipTo(start, end);
        text += slice(start, end).replace(HTML_MARKUP, "");
        return false;
      }
      if (!isUnread(node.name, node.node.parent?.name)) return true;
      skipTo(start, end);
      return false;
    },
  });
  skipTo(to, to);
  return text;
}

export function readableText(state: EditorState, from = 0, to = state.doc.length): string {
  return readableTextFrom(syntaxTree(state), (start, end) => state.sliceDoc(start, end), from, to);
}

export function collectHeadings(state: EditorState): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      const level = HEADING_LEVEL.exec(node.name)?.[1];
      // Headings never sit inside leaf blocks, so their content need not be walked
      if (level === undefined) return !LEAF_BLOCK.test(node.name);
      const first = node.node.firstChild;
      const plainAtx =
        node.name.startsWith("ATX") && first?.name === "HeaderMark" && first.nextSibling === null;
      const text = (
        plainAtx ? state.sliceDoc(first.to, node.to) : readableText(state, node.from, node.to)
      ).trim();
      headings.push({ level: Number(level), text, pos: node.from });
      return false;
    },
  });
  return headings;
}

/** The anchor a heading gets, written like GitHub does: lowercase, punctuation dropped, spaces as hyphens. */
function headingAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
    .replaceAll(/\s/g, "-");
}

/** The heading a `#anchor` link points to; repeated headings are told apart by -1, -2… as on GitHub. */
export function findHeadingByAnchor(
  headings: readonly OutlineHeading[],
  anchor: string,
): OutlineHeading | undefined {
  let wanted: string;
  try {
    wanted = decodeURIComponent(anchor).toLowerCase();
  } catch {
    return undefined;
  }
  const seen = new Map<string, number>();
  return headings.find(({ text }) => {
    const base = headingAnchor(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return (count === 0 ? base : `${base}-${count}`) === wanted;
  });
}

/** The section the cursor is in: the last heading at or before the cursor. */
export function findActiveHeading(headings: readonly OutlineHeading[], cursor: number): number {
  let low = 0;
  let high = headings.length - 1;
  let active = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const heading = headings[middle];
    if (heading === undefined) break;
    if (heading.pos <= cursor) {
      active = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return active;
}

/**
 * Folds a freshly collected outline into the one the window shows. The positions of unchanged
 * headings move with the text above them, but their rows do not have to be built again; keeping
 * the old objects lets the outline render only when a heading is added, removed or reworded.
 */
export function mergeHeadings(
  previous: OutlineHeading[],
  next: readonly OutlineHeading[],
): OutlineHeading[] {
  if (previous.length === next.length) {
    let unchanged = true;
    for (let index = 0; index < next.length; index++) {
      const before = previous[index];
      const after = next[index];
      if (!before || !after || before.level !== after.level || before.text !== after.text) {
        unchanged = false;
        break;
      }
      before.pos = after.pos;
    }
    if (unchanged) return previous;
  }
  return next.map((heading, index) => {
    const before = previous[index];
    if (before && before.level === heading.level && before.text === heading.text) {
      before.pos = heading.pos;
      return before;
    }
    return heading;
  });
}

function hasHeadingOrSpill(state: EditorState, from: number, to: number): boolean {
  let found = false;
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      if (HEADING_LEVEL.test(node.name)) {
        found = true;
        return false;
      }
      if (!LEAF_BLOCK.test(node.name)) return true;
      // A block that reaches past the edited lines (such as an unclosed fence) can hide or expose headings below
      if (node.to > to) found = true;
      return false;
    },
  });
  return found;
}

export interface HeadingUpdate {
  docChanged: boolean;
  changes: ChangeSet;
  startState: EditorState;
  state: EditorState;
}

/**
 * Whether an edit neither touched an existing heading nor created one, so the outline can shift
 * existing heading positions instead of walking the whole syntax tree.
 */
export function canShiftHeadings(
  headings: readonly OutlineHeading[],
  update: HeadingUpdate,
): boolean {
  if (!update.docChanged) return false;
  let ranges = 0;
  let canShift = true;
  update.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
    if (!canShift || ++ranges > 8) {
      canShift = false;
      return;
    }
    const firstLineA = update.startState.doc.lineAt(fromA);
    const checkFromA =
      firstLineA.number > 1
        ? update.startState.doc.line(firstLineA.number - 1).from
        : firstLineA.from;
    const checkToA = update.startState.doc.lineAt(toA).to;
    const active = findActiveHeading(headings, checkToA);
    const existing = headings[active];
    if (existing !== undefined && existing.pos >= checkFromA) {
      canShift = false;
      return;
    }
    const firstLineB = update.state.doc.lineAt(fromB);
    const checkFromB =
      firstLineB.number > 1 ? update.state.doc.line(firstLineB.number - 1).from : firstLineB.from;
    const checkToB = update.state.doc.lineAt(toB).to;
    if (
      hasHeadingOrSpill(update.startState, checkFromA, checkToA) ||
      hasHeadingOrSpill(update.state, checkFromB, checkToB)
    ) {
      canShift = false;
    }
  });
  return canShift;
}

/**
 * Shifts heading positions after an edit that neither touched an existing heading nor created one,
 * avoiding a walk of the whole syntax tree while typing ordinary prose.
 */
export function shiftHeadings(headings: OutlineHeading[], update: HeadingUpdate): boolean {
  if (!canShiftHeadings(headings, update)) return false;
  for (const heading of headings) {
    heading.pos = update.changes.mapPos(heading.pos);
  }
  return true;
}

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
