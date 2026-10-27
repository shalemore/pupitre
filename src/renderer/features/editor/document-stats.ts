import type { ChangeSet, EditorState } from "@codemirror/state";
import { countText, countTextFast, type TextStats } from "@/lib/text-stats";
import { readableText } from "./document-structure";

/**
 * Counting walks the whole document, and `Intl.Segmenter` takes about a second per megabyte. A
 * document above half a megabyte is therefore counted a slice at a time, without the segmenter and
 * without the syntax tree: the markers and link addresses it contains add a little to the totals,
 * but the count stays responsive where an exact one would freeze the editor.
 */
const EXACT_DOCUMENT_LIMIT = 512 * 1024;
const EXACT_TEXT_LIMIT = 64 * 1024;
const CHUNK = 2 * 1024 * 1024;
const SLICE_MS = 20;

/** The counts of a range, exact where it is small enough to afford the segmenter. */
export function countRange(state: EditorState, from: number, to: number): TextStats {
  // A selection of a large document is counted like the document itself rather than through the
  // syntax tree, which would be a second copy of hundreds of megabytes
  if (to - from > EXACT_DOCUMENT_LIMIT) {
    return countTextFast(state.doc.sliceString(from, to));
  }
  const text = readableText(state, from, to);
  return text.length <= EXACT_TEXT_LIMIT ? countText(text) : countTextFast(text);
}

function countTextRange(state: EditorState, from: number, to: number): TextStats {
  return countTextFast(state.doc.sliceString(from, to));
}

/** The end of a slice, kept on a line boundary so a word is never split between two counts. */
function sliceEnd(state: EditorState, from: number): number {
  const line = state.doc.lineAt(Math.min(from + CHUNK, state.doc.length));
  return Math.max(line.to, from);
}

function nextSlice(): Promise<void> {
  // A timer rather than an idle callback: the count has to keep moving even while the editor is
  // busy with a keystroke, and an idle slot that never comes would leave the title bar empty
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Counts the whole document, returning `undefined` when `cancelled` says a newer edit has made the
 * answer stale. A document small enough to count in one go still goes through `countRange`.
 */
export async function countDocument(
  state: EditorState,
  cancelled: () => boolean,
): Promise<TextStats | undefined> {
  const length = state.doc.length;
  if (cancelled()) return undefined;
  if (length <= EXACT_DOCUMENT_LIMIT) return countRange(state, 0, length);

  let words = 0;
  let characters = 0;
  let from = 0;

  const runSlices = async (): Promise<TextStats | undefined> => {
    let paused = false;
    while (from < length && !paused) {
      if (cancelled()) return undefined;
      const deadline = performance.now() + SLICE_MS;
      while (from < length && performance.now() < deadline) {
        const to = sliceEnd(state, from);
        const stats = countTextRange(state, from, to);
        words += stats.words;
        characters += stats.characters;
        from = to < length ? to + 1 : length;
      }
      paused = from < length;
    }
    if (paused) {
      await nextSlice();
      if (cancelled()) return undefined;
      return runSlices();
    }
    return { words, characters };
  };

  return runSlices();
}

// A change this large is cheaper to count again than to take apart; smaller ones keep the totals
// current by counting just the lines they touched
const MAX_INCREMENTAL_CHARACTERS = 256 * 1024;
const MAX_INCREMENTAL_RANGES = 64;

interface ChangedRange {
  fromA: number;
  toA: number;
  fromB: number;
  toB: number;
}

interface LineRange {
  from: number;
  to: number;
}

/** The whole lines a changed range touches, since Markdown syntax is decided a line at a time. */
function changedLines(state: EditorState, from: number, to: number): LineRange {
  const length = state.doc.length;
  return {
    from: state.doc.lineAt(Math.min(from, length)).from,
    to: state.doc.lineAt(Math.min(to, length)).to,
  };
}

function mergeLines(ranges: readonly LineRange[]): LineRange[] {
  const merged: LineRange[] = [];
  for (const range of ranges.toSorted((a, b) => a.from - b.from)) {
    const last = merged.at(-1);
    if (last && range.from <= last.to) last.to = Math.max(last.to, range.to);
    else merged.push({ ...range });
  }
  return merged;
}

interface StatsUpdate {
  startState: EditorState;
  state: EditorState;
  changes: ChangeSet;
}

export interface StatsTracker {
  /** Count the document the editor was built around. */
  start: (state: EditorState) => void;
  /** Adjust the totals after an edit, or remember it while the first count is still running. */
  changed: (update: StatsUpdate) => void;
  /** Report the counts of the selection next to the totals that are known. */
  selection: (state: EditorState) => void;
  /**
   * A background parse has caught up with a small document, whose first count may have read the
   * not-yet-parsed remainder as raw text; count it once more, without delaying anything.
   */
  refresh: (state: EditorState) => void;
  dispose: () => void;
}

/**
 * Keeps the word and character counts of one editor. The first count of a large document runs in
 * slices; after that, a keystroke only recounts the lines it touched, so the totals follow typing
 * without a debounce and without copying the document.
 */
export function createStatsTracker(report: (stats: TextStats) => void): StatsTracker {
  let totals: TextStats = { words: 0, characters: 0 };
  /** The state the totals belong to, once the first count has finished. */
  let baseline: EditorState | undefined;
  let latest: EditorState | undefined;
  let counting = true;
  let run = 0;
  let pending: ChangeSet | undefined;
  /** Whether the totals above the exact limit were read as raw Markdown, so an edit counts the same way. */
  let raw = false;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;

  const reportState = (state: EditorState) => {
    const { main } = state.selection;
    if (main.empty) {
      report(totals);
      return;
    }
    const selected = countRange(state, main.from, main.to);
    report({
      words: totals.words,
      characters: totals.characters,
      selectedWords: selected.words,
      selectedCharacters: selected.characters,
    });
  };

  /** Applies changed line ranges to the totals; false when the change is too broad to take apart. */
  const countLines = (
    fromState: EditorState,
    toState: EditorState,
    changes: ChangeSet,
  ): boolean => {
    const changed: ChangedRange[] = [];
    changes.iterChangedRanges((fromA, toA, fromB, toB) => {
      changed.push({ fromA, toA, fromB, toB });
    });
    const edited = changed.reduce(
      (total, range) => total + range.toA - range.fromA + range.toB - range.fromB,
      0,
    );
    if (changed.length === 0 || changed.length > MAX_INCREMENTAL_RANGES) return false;
    if (edited > MAX_INCREMENTAL_CHARACTERS) return false;

    const beforeLines = mergeLines(
      changed.map((range) => changedLines(fromState, range.fromA, range.toA)),
    );
    const afterLines = mergeLines(
      changed.map((range) => changedLines(toState, range.fromB, range.toB)),
    );
    if (beforeLines.length !== afterLines.length) return false;
    const count = raw ? countTextRange : countRange;
    for (let index = 0; index < beforeLines.length; index++) {
      const before = beforeLines[index];
      const after = afterLines[index];
      if (!before || !after) return false;
      // A single line that large is a document of its own, not something to count twice a key
      if (after.to - after.from > MAX_INCREMENTAL_CHARACTERS) return false;
      const old = count(fromState, before.from, before.to);
      const next = count(toState, after.from, after.to);
      totals = {
        words: Math.max(0, totals.words + next.words - old.words),
        characters: Math.max(0, totals.characters + next.characters - old.characters),
      };
    }
    return true;
  };

  const countAll = (state: EditorState) => {
    const currentRun = ++run;
    counting = true;
    raw = state.doc.length > EXACT_DOCUMENT_LIMIT;
    baseline = state;
    latest = state;
    pending = undefined;
    void countDocument(state, () => currentRun !== run).then((counted) => {
      if (counted === undefined || currentRun !== run) return;
      totals = counted;
      counting = false;
      const changes = pending;
      pending = undefined;
      const current = latest ?? state;
      if (changes !== undefined) {
        if (countLines(state, current, changes)) {
          baseline = current;
          reportState(current);
        } else {
          countAll(current);
        }
      } else {
        reportState(current);
      }
    });
  };

  return {
    start: (state) => {
      latest = state;
      baseline = state;
      if (state.doc.length <= EXACT_DOCUMENT_LIMIT) {
        totals = countRange(state, 0, state.doc.length);
        counting = false;
        reportState(state);
        return;
      }
      countAll(state);
    },
    changed: (update) => {
      latest = update.state;
      if (counting || baseline === undefined || baseline.doc !== update.startState.doc) {
        pending = pending ? pending.compose(update.changes) : update.changes;
        return;
      }
      if (countLines(update.startState, update.state, update.changes)) {
        baseline = update.state;
        reportState(update.state);
      } else {
        countAll(update.state);
      }
    },
    selection: (state) => {
      latest = state;
      reportState(state);
    },
    refresh: (state) => {
      if (state.doc.length > EXACT_DOCUMENT_LIMIT) return;
      latest = state;
      if (refreshTimer !== undefined) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        if (counting || latest === undefined) return;
        totals = countRange(latest, 0, latest.doc.length);
        baseline = latest;
        reportState(latest);
      }, 250);
    },
    dispose: () => {
      run++;
      if (refreshTimer !== undefined) clearTimeout(refreshTimer);
    },
  };
}
