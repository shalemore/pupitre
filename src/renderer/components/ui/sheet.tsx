import { cn } from "cn";
import { type Component, type JSX, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";

export interface SheetProps {
  /** Names the dialog, for anyone who cannot see the window it covers. */
  title: string;
  /** Where the sheet sits: a palette is centred, a search hangs under the title bar. */
  placement?: "center" | "top";
  onKeyDown: (event: KeyboardEvent) => void;
  onClose: () => void;
  children: JSX.Element;
}

/** What can take the keyboard inside a sheet, which are the controls Tab walks through. */
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** The controls of `panel` that Tab reaches, in the order it reaches them. */
function focusableIn(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) =>
      // A row of a list is a button the arrow keys move through, taken out of that order on purpose
      element.tabIndex >= 0 && !element.matches(":disabled") && element.checkVisibility(),
  );
}

/** Moves the focus around the panel the way Tab does at its ends, so it never leaves the sheet. */
function trapTab(event: KeyboardEvent, panel: HTMLElement): void {
  const focusable = focusableIn(panel);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (first === undefined || last === undefined) return;
  const focused = document.activeElement;
  // A focus that sits outside the panel goes back to where Tab starts
  if (!(focused instanceof HTMLElement) || !panel.contains(focused)) {
    event.preventDefault();
    first.focus();
    return;
  }
  if (focused === last && !event.shiftKey) {
    event.preventDefault();
    first.focus();
  } else if (focused === first && event.shiftKey) {
    event.preventDefault();
    last.focus();
  }
}

/**
 * A panel over the window, holding a query and the rows it picks. A press beside the sheet closes
 * it; the sheet itself takes the keyboard while it is up, Tab included, and gives it back to
 * whatever held it before. It is drawn outside the window's own tree, because the title bar clips
 * its children and the sheet covers them.
 */
export const Sheet: Component<SheetProps> = (props) => {
  // Read while the sheet is being made, before whoever opens it moves the focus into it
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  onCleanup(() => {
    if (opener?.isConnected === true) opener.focus();
  });

  let panel: HTMLDivElement | undefined;

  return (
    <Portal>
      <div
        data-slot="sheet-backdrop"
        class={cn(
          "fixed inset-0 z-50 flex justify-center bg-surface-0/60 p-4 backdrop-blur-sm animate-in fade-in-0 duration-base",
          props.placement === "top" ? "items-start pt-16" : "items-center",
        )}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return;
          // The press must not move the focus itself, or it lands on the page the sheet uncovers
          event.preventDefault();
          props.onClose();
        }}
      >
        <div
          data-slot="sheet"
          ref={(element) => (panel = element)}
          role="dialog"
          aria-modal="true"
          aria-label={props.title}
          onKeyDown={(event) => {
            if (event.key === "Tab" && panel !== undefined) return trapTab(event, panel);
            props.onKeyDown(event);
          }}
          class={cn(
            "floating-panel flex max-h-full w-full flex-col gap-2 p-2 text-xs",
            props.placement === "top" ? "max-w-xl" : "max-w-lg",
          )}
        >
          {props.children}
        </div>
      </div>
    </Portal>
  );
};
