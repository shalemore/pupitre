import { createSignal, onCleanup } from "solid-js";
import { readDuration } from "@/lib/motion";

/** Used when the stylesheet cannot say how long the panel's exit takes. */
const DEFAULT_EXIT_DURATION = 150;

/** How long the panel's exit animation runs, from the duration token the closed state asks for. */
function exitDuration(): number {
  const style = getComputedStyle(document.documentElement);
  return readDuration(style.getPropertyValue("--transition-duration-ui"), DEFAULT_EXIT_DURATION);
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
}

export interface MenuOptions {
  /** Told when the menu opens, and as soon as it starts to close. */
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** Runs before the panel starts to fold, even while it is still being looked up. */
  onClose?: (() => void) | undefined;
}

/**
 * The state a trigger shares with its menu: the panel stays drawn while its exit animation plays.
 * Closing gives the focus back to where it was before the menu took it, so typing continues where
 * it stopped.
 */
export function createMenu<T>(options: MenuOptions = {}): Menu<T> {
  const [shown, setShown] = createSignal<T>();
  const [closing, setClosing] = createSignal(false);
  let exitTimer: number | undefined;
  let previousFocus: HTMLElement | undefined;

  function close(this: void) {
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

  function show(this: void, state: T) {
    window.clearTimeout(exitTimer);
    exitTimer = undefined;
    previousFocus ??=
      document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    setClosing(false);
    // The updater form sets the value even when T itself could be a function
    setShown(() => state);
    options.onOpenChange?.(true);
  }

  onCleanup(() => {
    window.clearTimeout(exitTimer);
    options.onOpenChange?.(false);
  });

  return {
    shown,
    closing,
    open: () => (closing() ? undefined : shown()),
    show,
    close,
  };
}
