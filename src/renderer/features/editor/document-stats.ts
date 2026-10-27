import { ensureSyntaxTree } from "@codemirror/language";
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

function countTextRange(state: EditorState, from: number, to: number): TextStats {
  return countTextFast(state.doc.sliceString(from, to));
}

/** The end of a slice, kept on a line boundary so a word is never split between two counts. */
function sliceEnd(state: EditorState, from: number, limit = state.doc.length): number {
  if (from + CHUNK >= limit) return limit;
  const line = state.doc.lineAt(from + CHUNK);
  return Math.min(Math.max(line.to, from), limit);
}

/** The counts of a range, exact where it is small enough to afford the segmenter. */
export function countRange(state: EditorState, from: number, to: number): TextStats {
  // A selection of a large document is counted like the document itself rather than through the
  // syntax tree, which would be a second copy of hundreds of megabytes
  if (to - from > EXACT_DOCUMENT_LIMIT) {
    let words = 0;
    let characters = 0;
    let cjk = 0;
    for (let pos = from; pos < to;) {
      const end = sliceEnd(state, pos, to);
      const stats = countTextRange(state, pos, end);
      words += stats.words;
      characters += stats.characters;
      cjk += stats.cjk;
      pos = end < to ? end + 1 : to;
    }
    return { words, characters, cjk };
  }
  const text = readableText(state, from, to);
  return text.length <= EXACT_TEXT_LIMIT ? countText(text) : countTextFast(text);
}

function nextSlice(): Promise<void> {
  // A timer rather than an idle callback: the count has to keep moving even while the editor is
  // busy with a keystroke, and an idle slot that never comes would leave the title bar empty
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Counts a range of the document in time-bounded slices, returning `undefined` when `cancelled`
 * says a newer edit or selection has made the answer stale.
 */
async function countRangeInSlices(
  state: EditorState,
  start: number,
  end: number,
  cancelled: () => boolean,
): Promise<TextStats | undefined> {
  if (cancelled()) return undefined;
  if (end - start <= EXACT_DOCUMENT_LIMIT) return countRange(state, start, end);

  let words = 0;
  let characters = 0;
  let cjk = 0;
  let from = start;

  const runSlices = async (): Promise<TextStats | undefined> => {
    let paused = false;
    while (from < end && !paused) {
      if (cancelled()) return undefined;
      const deadline = performance.now() + SLICE_MS;
      while (from < end && performance.now() < deadline) {
        const to = sliceEnd(state, from, end);
        const stats = countTextRange(state, from, to);
        words += stats.words;
        characters += stats.characters;
        cjk += stats.cjk;
        from = to < end ? to + 1 : end;
      }
      paused = from < end;
    }
    if (paused) {
      await nextSlice();
      if (cancelled()) return undefined;
      return runSlices();
    }
    return { words, characters, cjk };
  };

  return runSlices();
}

/**
 * Counts the whole document, returning `undefined` when `cancelled` says a newer edit has made the
 * answer stale. A document small enough to count in one go still goes through `countRange`.
 */
export async function countDocument(
  state: EditorState,
  cancelled: () => boolean,
): Promise<TextStats | undefined> {
  return countRangeInSlices(state, 0, state.doc.length, cancelled);
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
  let totals: TextStats = { words: 0, characters: 0, cjk: 0 };
  /** The state the totals belong to, once the first count has finished. */
  let baseline: EditorState | undefined;
  let latest: EditorState | undefined;
  let counting = true;
  let run = 0;
  let selectionRun = 0;
  let pending: ChangeSet | undefined;
  /** Whether the totals above the exact limit were read as raw Markdown, so an edit counts the same way. */
  let raw = false;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;

  const reportWithSelection = (selected: TextStats) => {
    report({
      words: totals.words,
      characters: totals.characters,
      cjk: totals.cjk,
      selectedWords: selected.words,
      selectedCharacters: selected.characters,
      selectedCjk: selected.cjk,
    });
  };

  const reportState = (state: EditorState) => {
    const { main } = state.selection;
    const currentSelectionRun = ++selectionRun;
    if (main.empty) {
      report(totals);
      return;
    }
    // Selecting the whole document needs no second scan once the document total is known
    if (!counting && main.from === 0 && main.to === state.doc.length) {
      reportWithSelection(totals);
      return;
    }
    if (main.to - main.from <= EXACT_DOCUMENT_LIMIT) {
      reportWithSelection(countRange(state, main.from, main.to));
      return;
    }
    void countRangeInSlices(
      state,
      main.from,
      main.to,
      () => currentSelectionRun !== selectionRun,
    ).then((selected) => {
      if (selected === undefined || currentSelectionRun !== selectionRun) return;
      reportWithSelection(selected);
    });
  };

  /** Applies changed line ranges to the totals; false when the change is too broad to take apart. */
  const countLines = (
    fromState: EditorState,
    toState: EditorState,
    changes: ChangeSet,
  ): boolean => {
    const changed: ChangedRange[] = [];
    let edited = 0;
    let tooBroad = false;
    changes.iterChangedRanges((fromA, toA, fromB, toB) => {
      if (tooBroad) return;
      edited += toA - fromA + toB - fromB;
      if (changed.length >= MAX_INCREMENTAL_RANGES || edited > MAX_INCREMENTAL_CHARACTERS) {
        tooBroad = true;
        return;
      }
      changed.push({ fromA, toA, fromB, toB });
    });
    if (tooBroad || changed.length === 0) return false;

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
        cjk: Math.max(0, totals.cjk + next.cjk - old.cjk),
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
      if (state.doc.length <= EXACT_DOCUMENT_LIMIT) {
        // A document just opened or replaced has no syntax tree in its state yet, and counting it
        // then would read Markdown markers as text; parse what this size allows and take the state
        // the parse reached before the first count, so the title bar never shows a number the next
        // count has to correct
        let current = state;
        if (state.doc.length <= EXACT_TEXT_LIMIT) {
          ensureSyntaxTree(state, state.doc.length, 100);
          current = state.update({}).state;
        }
        latest = current;
        baseline = current;
        totals = countRange(current, 0, current.doc.length);
        counting = false;
        reportState(current);
        return;
      }
      latest = state;
      baseline = state;
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
      selectionRun++;
      if (refreshTimer !== undefined) clearTimeout(refreshTimer);
    },
  };
}
