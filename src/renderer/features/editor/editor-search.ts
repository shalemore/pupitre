import { getSearchQuery, SearchQuery } from "@codemirror/search";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export interface SearchOptions {
  search: string;
  replace: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regexp: boolean;
}

export interface MatchStats {
  /** 1-based index of the selected match; 0 when no match is selected. */
  current: number;
  total: number;
  /** The total is still being counted; the arrows can be used meanwhile. */
  pending?: boolean;
  /** The document has more matches than the count is willing to walk. */
  capped?: boolean;
}

// Counting every match of a large document is another walk through the whole text; below this
// size it is cheap enough to do before returning, above it the count runs in slices
const SYNC_MATCH_LIMIT = 512 * 1024;
// A find bar does not need the exact number of matches in a book-length document
const MAX_COUNTED_MATCHES = 1_000;
const MATCH_COUNT_SLICE_MS = 8;
const MAX_INITIAL_SEARCH_LENGTH = 200;

function countMatches(state: EditorState, query: SearchQuery): MatchStats {
  const { from, to } = state.selection.main;
  let total = 0;
  let current = 0;
  const cursor = query.getCursor(state);
  for (let match = cursor.next(); !match.done; match = cursor.next()) {
    total++;
    if (match.value.from === from && match.value.to === to) current = total;
  }
  return { current, total };
}

async function countMatchesInSlices(
  state: EditorState,
  query: SearchQuery,
  cancelled: () => boolean,
): Promise<MatchStats | undefined> {
  const { from, to } = state.selection.main;
  let total = 0;
  let current = 0;
  const cursor = query.getCursor(state);

  const runSlice = async (): Promise<MatchStats | undefined> => {
    const deadline = performance.now() + MATCH_COUNT_SLICE_MS;
    while (performance.now() < deadline) {
      const match = cursor.next();
      if (match.done) return { current, total };
      total++;
      if (match.value.from === from && match.value.to === to) current = total;
      if (total >= MAX_COUNTED_MATCHES) return { current, total, capped: true };
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (cancelled()) return undefined;
    return runSlice();
  };

  return runSlice();
}

/**
 * The match count the find bar shows. A small document is counted before the answer returns; a
 * large one starts a background count, cancelled by the next search, and says it is pending.
 */
export function createMatchCounter(counted: (stats: MatchStats) => void) {
  let run = 0;

  const request = (view: EditorView): MatchStats => {
    const query = getSearchQuery(view.state);
    if (!query.valid || query.search === "") {
      run++;
      return { current: 0, total: 0 };
    }
    if (view.state.doc.length <= SYNC_MATCH_LIMIT) {
      run++;
      return countMatches(view.state, query);
    }
    const current = ++run;
    void countMatchesInSlices(view.state, query, () => current !== run).then((stats) => {
      if (stats !== undefined && current === run) counted(stats);
    });
    return { current: 0, total: 0, pending: true };
  };

  return { cancel: () => void run++, request };
}

/** The selected text the find bar opens with: one line, and short enough to stand for a search. */
export function selectedSearchText(state: EditorState): string {
  const { from, to } = state.selection.main;
  if (to === from || to - from > MAX_INITIAL_SEARCH_LENGTH) return "";
  const selected = state.sliceDoc(from, to);
  return selected.includes("\n") ? "" : selected;
}
