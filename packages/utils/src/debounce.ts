/**
 * Runs `callback` once the calls stop for `wait` milliseconds; `clear` drops a call still waiting.
 *
 * This is `debounce` from `@solid-primitives/scheduled`, without the half that does not fit Solid 2:
 * the primitive registers its timer with `onCleanup` whenever a component owns it, and Solid forbids
 * `onCleanup` inside `onSettled`, which is where the editor and the window build theirs. A timer is
 * not reactive state, so nothing here needs an owner; every caller clears it where it is disposed.
 */
export interface Debounced<Args extends readonly unknown[]> {
  (...args: Args): void;
  clear: () => void;
}

export function debounce<Args extends readonly unknown[]>(
  callback: (...args: Args) => void,
  wait: number,
): Debounced<Args> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  const debounced = (...args: Args) => {
    clear();
    timer = setTimeout(() => {
      timer = undefined;
      callback(...args);
    }, wait);
  };

  return Object.assign(debounced, { clear });
}
