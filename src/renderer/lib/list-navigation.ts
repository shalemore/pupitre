import { createEffect, createMemo, createSelector, createSignal } from "solid-js";

export interface ListNavigation {
  /** The row the keyboard points at, clamped to the rows that exist. */
  active: () => number;
  /** Whether the row at `index` is the one the keyboard points at. */
  isActive: (index: number) => boolean;
  /** Points at a row, by index: the pointer says so when it enters one. */
  pointAt: (index: number) => void;
  /** Starts a new list at its first row. */
  reset: () => void;
  /** Where the arrow keys, Enter and Escape go when the event is one of theirs. */
  onKeyDown: (
    event: KeyboardEvent,
    handlers: { pick: (index: number) => void; close: () => void },
  ) => void;
}

/**
 * The keyboard over a list of rows that a query narrows: the row it points at, the keys that move
 * between them, and the scrolling that keeps the row on show. The sheet the list sits in and what a
 * row holds stay with the caller.
 */
export function createListNavigation(
  count: () => number,
  list: () => HTMLElement | undefined,
): ListNavigation {
  const [wanted, setWanted] = createSignal(0);
  // Clamped rather than reset, so a list that narrows under the query never points past its end
  const active = createMemo(() => Math.min(wanted(), Math.max(count() - 1, 0)));
  // Every row subscribes to its own boolean, so moving the highlight does not update the list
  const isActive = createSelector(active);

  // The highlight follows the list; it has to be seen even when it moved past the port
  createEffect(() => {
    list()?.querySelector(`[data-index="${active()}"]`)?.scrollIntoView({ block: "nearest" });
  });

  const move = (step: number) => {
    const length = count();
    if (length === 0) return;
    setWanted((active() + step + length) % length);
  };

  return {
    active,
    isActive,
    pointAt: setWanted,
    reset: () => setWanted(0),
    onKeyDown: (event, { pick, close }) => {
      // Enter while composing with an input method confirms the candidate, not the row
      if (event.isComposing) return;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          return move(1);
        case "ArrowUp":
          event.preventDefault();
          return move(-1);
        case "Enter":
          event.preventDefault();
          return pick(active());
        case "Escape":
          event.preventDefault();
          return close();
        default:
          return;
      }
    },
  };
}
