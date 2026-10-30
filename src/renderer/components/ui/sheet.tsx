import { Dialog } from "@kobalte/core/dialog";
import type { Component, JSX } from "solid-js";
import { css, cx } from "@/styled-system/css";

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

const backdrop = css({
  position: "fixed",
  inset: "0",
  zIndex: "50",
  backgroundColor: "surface.0/60",
  backdropFilter: "blur(4px)",
  animationName: "fadeIn",
  animationDuration: "base",
  animationTimingFunction: "enter",
});
const panel = css({
  position: "fixed",
  left: "50%",
  zIndex: "50",
  display: "flex",
  width: "calc(100% - 2rem)",
  flexDirection: "column",
  gap: "2",
  padding: "2",
  textStyle: "xs",
});
const atTop = css({
  "--panel-translate-x": "-50%",
  "--panel-translate-y": "0px",
  translate: "-50% 0",
  top: "16",
  maxHeight: "calc(100vh - 5rem)",
  maxWidth: "xl",
});
const centered = css({
  "--panel-translate-x": "-50%",
  "--panel-translate-y": "-50%",
  translate: "-50% -50%",
  top: "50%",
  maxHeight: "calc(100vh - 2rem)",
  maxWidth: "lg",
});

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
      <Dialog.Overlay data-slot="sheet-backdrop" class={backdrop} />
      <Dialog.Content
        data-slot="sheet"
        class={cx("floating-panel", panel, props.placement === "top" ? atTop : centered)}
        onKeyDown={props.onKeyDown}
      >
        <Dialog.Title class={css({ srOnly: true })}>{props.title}</Dialog.Title>
        {props.children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog>
);
