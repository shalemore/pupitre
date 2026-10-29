import { Dialog } from "@kobalte/core/dialog";
import { cn } from "cn";
import type { Component, JSX } from "solid-js";

export interface SheetProps {
  /** Names the dialog, for anyone who cannot see the window it covers. */
  title: string;
  /** Where the sheet sits: a palette is centred, a search hangs under the title bar. */
  placement?: "center" | "top";
  /** Handles keys the content cares about before the dialog does; a list that walks itself uses it. */
  onKeyDown?: (event: KeyboardEvent) => void;
  onClose: () => void;
  children: JSX.Element;
}

/**
 * A panel over the window, holding a query and the rows it picks. Kobalte traps the focus, gives it
 * back, and closes the sheet on a press beside it or on Escape. It is drawn outside the window's
 * own tree, because the title bar clips its children and the sheet covers them.
 */
export const Sheet: Component<SheetProps> = (props) => (
  <Dialog
    open
    onOpenChange={(open) => {
      if (!open) props.onClose();
    }}
  >
    <Dialog.Portal>
      <Dialog.Overlay
        data-slot="sheet-backdrop"
        class="fixed inset-0 z-50 bg-surface-0/60 backdrop-blur-sm animate-in fade-in-0 duration-base"
      />
      <Dialog.Content
        data-slot="sheet"
        class={cn(
          "floating-panel fixed left-1/2 z-50 flex w-[calc(100%-2rem)] -translate-x-1/2 flex-col gap-2 p-2 text-xs",
          props.placement === "top"
            ? "top-16 max-h-[calc(100vh-5rem)] max-w-xl"
            : "top-1/2 max-h-[calc(100vh-2rem)] max-w-lg -translate-y-1/2",
        )}
        onKeyDown={props.onKeyDown}
      >
        <Dialog.Title class="sr-only">{props.title}</Dialog.Title>
        {props.children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog>
);
