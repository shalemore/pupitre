import { debounce } from "@solid-primitives/scheduled";
import { createSignal, onCleanup } from "solid-js";

/** How long the pointer may be away from a trigger and its menu before it folds up. */
const LEAVE_DELAY = 200;
/** Used when the stylesheet cannot say how long the panel's exit takes. */
const DEFAULT_EXIT_DURATION = 150;

/** How long the panel's exit animation runs, from the duration token the closed state asks for. */
function exitDuration(): number {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--transition-duration-ui")
    .trim();
  const length = Number.parseFloat(value);
  if (!Number.isFinite(length)) return DEFAULT_EXIT_DURATION;
  return value.endsWith("s") && !value.endsWith("ms") ? length * 1000 : length;
}

export interface Menu<T> {
  /** What the panel shows, kept while it animates out. */
  readonly shown: () => T | undefined;
  /** Whether the panel is folding away. */
  readonly closing: () => boolean;
  /** What the pointer and the keyboard work with; gone as soon as the menu closes. */
  readonly open: () => T | undefined;
  show: (state: T) => void;
  close: () => void;
  /** Folds the menu up after the pointer has been away for a moment. */
  leave: () => void;
  /** Keeps the menu open because the pointer came back. */
  cancelLeave: () => void;
}

export interface MenuOptions {
  /** Told when the menu opens, and as soon as it starts to close. */
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** Runs before the panel starts to fold, even while it is still being looked up. */
  onClose?: (() => void) | undefined;
}

/**
 * The state a trigger shares with its menu: the panel stays drawn while its exit animation plays,
 * and a pointer that crosses the gap to the panel has time to come back. Closing gives the focus
 * back to where it was before the menu took it, so typing continues where it stopped.
 */
export function createMenu<T>(options: MenuOptions = {}): Menu<T> {
  const [shown, setShown] = createSignal<T>();
  const [closing, setClosing] = createSignal(false);
  let exitTimer: number | undefined;
  let previousFocus: HTMLElement | undefined;

  function close(this: void) {
    leave.clear();
    options.onClose?.();
    if (shown() === undefined || closing()) return;
    setClosing(true);
    options.onOpenChange?.(false);
    previousFocus?.focus();
    previousFocus = undefined;
    exitTimer = window.setTimeout(() => {
      exitTimer = undefined;
      setClosing(false);
      setShown(undefined);
    }, exitDuration());
  }

  const leave = debounce(() => close(), LEAVE_DELAY);

  function show(this: void, state: T) {
    window.clearTimeout(exitTimer);
    exitTimer = undefined;
    leave.clear();
    previousFocus ??=
      document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    setClosing(false);
    // The updater form sets the value even when T itself could be a function
    setShown(() => state);
    options.onOpenChange?.(true);
  }

  onCleanup(() => {
    window.clearTimeout(exitTimer);
    leave.clear();
    options.onOpenChange?.(false);
  });

  return {
    shown,
    closing,
    open: () => (closing() ? undefined : shown()),
    show,
    close,
    leave: () => leave(),
    cancelLeave: () => leave.clear(),
  };
}
