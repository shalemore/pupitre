import { Dialog } from "@kobalte/core/dialog";
import { cn } from "cn";
import type { Component, JSX } from "solid-js";

export interface SheetProps {
  /** Names the dialog, for anyone who cannot see the window it covers. */
  title: string;
  /** Where the sheet sits: a palette is centred, a search hangs under the title bar. */
  placement?: "center" | "top";
  onKeyDown: (event: KeyboardEvent) => void;
  onClose: () => void;
  children: JSX.Element;
}

/**
 * A panel over the window, holding a query and the rows it picks. Kobalte traps the focus and
 * gives it back, and a press beside the panel closes it. It is drawn outside the window's own tree,
 * because the title bar clips its children and the sheet covers them.
 */
export const Sheet: Component<SheetProps> = (props) => (
  <Dialog
    open
    onOpenChange={(open) => {
      if (!open) props.onClose();
    }}
  >
    <Dialog.Portal>
      <Dialog.Content
        data-slot="sheet-backdrop"
        class={cn(
          "fixed inset-0 z-50 flex justify-center bg-surface-0/60 p-4 backdrop-blur-sm animate-in fade-in-0 duration-base",
          props.placement === "top" ? "items-start pt-16" : "items-center",
        )}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          props.onClose();
        }}
        onKeyDown={props.onKeyDown}
      >
        <Dialog.Title class="sr-only">{props.title}</Dialog.Title>
        <div
          data-slot="sheet"
          class={cn(
            "floating-panel flex max-h-full w-full flex-col gap-2 p-2 text-xs",
            props.placement === "top" ? "max-w-xl" : "max-w-lg",
          )}
        >
          {props.children}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog>
);
