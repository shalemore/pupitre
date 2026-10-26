import { cn } from "cn";
import { type Component, type JSX } from "solid-js";
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

/**
 * A panel over the window, holding a query and the rows it picks. A press beside the sheet closes
 * it; the sheet itself takes the keyboard while it is up. It is drawn outside the window's own tree,
 * because the title bar clips its children and the sheet covers them.
 */
export const Sheet: Component<SheetProps> = (props) => (
  <Portal>
    <div
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
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        onKeyDown={props.onKeyDown}
        class={cn(
          "floating-panel flex max-h-full w-full flex-col gap-2 p-2 text-xs animate-in fade-in-0 zoom-in-95 duration-base ease-enter",
          props.placement === "top" ? "max-w-xl" : "max-w-lg",
        )}
      >
        {props.children}
      </div>
    </div>
  </Portal>
);
