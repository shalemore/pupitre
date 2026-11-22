import type { JSX } from "@solidjs/web";
import { Dialog, DialogBackdrop, DialogContent, DialogTitle } from "@ui-sdk/solid/dialog";
import { cn } from "cn";
import type { Component } from "solid-js";

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
 * A panel over the window, holding a query and the rows it picks. UI SDK traps the focus, gives it
 * back, and closes the sheet on a press beside it or on Escape. It is drawn outside the window's
 * own tree, because the title bar clips its children and the sheet covers them.
 *
 * The parts carry `data-sheet` rather than `data-slot`: UI SDK names its own slots with `data-slot`
 * and its value wins over the one a caller passes, so a sheet's anchor has to be a name of its own.
 */
export const Sheet: Component<SheetProps> = (props) => (
  <Dialog
    open
    onOpenChange={(open) => {
      if (!open) props.onClose();
    }}
  >
    <DialogBackdrop
      data-sheet="backdrop"
      class="fixed inset-0 z-50 animate-fade-in bg-surface-0/60 backdrop-blur-xs"
    />
    <DialogContent
      data-sheet="panel"
      class={cn(
        "__FLOATING_PANEL__ fixed left-1/2 z-50 flex w-[calc(100%-2rem)] flex-col gap-2 p-2 text-xs",
        props.placement === "top"
          ? "top-16 max-h-[calc(100vh-5rem)] max-w-xl -translate-x-1/2 translate-y-0 [--panel-translate-x:-50%] [--panel-translate-y:0px]"
          : "top-1/2 max-h-[calc(100vh-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 [--panel-translate-x:-50%] [--panel-translate-y:-50%]",
      )}
      onKeyDown={props.onKeyDown}
    >
      <DialogTitle class="sr-only">{props.title}</DialogTitle>
      {props.children}
    </DialogContent>
  </Dialog>
);
