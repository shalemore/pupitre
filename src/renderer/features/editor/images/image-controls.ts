import type { EditorView } from "@codemirror/view";
import { t } from "@/i18n";
import type { DocumentImage, ImageAlignment, ImageSize } from "@/lib/markdown/images";
import { css, cx } from "@/styled-system/css";

/**
 * The controls of a picture: the corner handle that resizes it and the bar that aligns it. Both
 * write their choice into the source as one change.
 */

/** A picture narrower than this cannot be grabbed by its handle again. */
const MIN_IMAGE_WIDTH = 32;

/** The room the bar of a picture keeps from the edges of its frame, in pixels at the root size. */
export const TOOLBAR_INSET = 6;

const handleStyle = css({
  position: "absolute",
  insetBlockEnd: "-1",
  insetInlineEnd: "-1",
  width: "3",
  height: "3",
  borderRadius: "full",
  borderWidth: "hairline",
  borderStyle: "solid",
  borderColor: "surface.1",
  backgroundColor: "brand",
  boxShadow: "sm",
  cursor: "nwse-resize",
  userSelect: "none",
  opacity: 0,
  visibility: "hidden",
  _groupHover: { opacity: 1, visibility: "visible" },
  _groupFocusWithin: { opacity: 1, visibility: "visible" },
  _rtl: { cursor: "nesw-resize" },
});
const toolbarStyle = css({
  position: "absolute",
  gap: "0.5",
  borderRadius: "lg",
  backgroundColor: "surface.3",
  padding: "0.5",
  boxShadow: "float",
  userSelect: "none",
  opacity: 0,
  visibility: "hidden",
  _groupHover: { opacity: 1, visibility: "visible" },
  _groupFocusWithin: { opacity: 1, visibility: "visible" },
});
const alignButton = css({
  display: "grid",
  width: "6",
  height: "6",
  placeItems: "center",
  borderRadius: "md",
  borderWidth: 0,
  backgroundColor: "transparent",
  padding: 0,
  color: "tertiary",
  cursor: "pointer",
  layerStyle: "interactive",
  _hover: { backgroundColor: "accent", color: "foreground" },
  _focusVisible: { outlineStyle: "none", boxShadow: "focus" },
  "&[aria-pressed='true']": { backgroundColor: "selected", color: "foreground" },
});

/**
 * The corner handle that sizes the picture. It drags the picture on the screen and writes the width
 * into its source once, when the pointer is released, so that one drag is one change to undo.
 */
export function resizeHandle(
  view: EditorView,
  block: HTMLElement,
  write: (change: (image: DocumentImage) => ImageSize) => void,
  frame: HTMLElement,
  image: HTMLImageElement,
): HTMLElement {
  const handle = document.createElement("span");
  // Interface rather than document, sized in rem like the corner of a code block
  handle.className = cx("md-image-handle", handleStyle);
  handle.title = t().editor.image.resize;

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    // The drag is not a gesture the line has to select text for
    event.preventDefault();
    const start = event.clientX;
    const startWidth = frame.getBoundingClientRect().width;
    // The line the picture stands on, which a picture of its own size is narrower than
    const room = (block.parentElement ?? block).getBoundingClientRect().width;
    // An unmeasured line puts no limit on the width
    const limit = room > 0 ? Math.round(room) : Number.POSITIVE_INFINITY;
    const original = image.style.width;
    // The handle hangs at the end of the line, which is the left edge of a right-to-left document
    const step = getComputedStyle(image).direction === "rtl" ? -1 : 1;
    let width = Math.round(startWidth);

    const dragged = (move: PointerEvent) => {
      const grown = Math.round(startWidth + (move.clientX - start) * step);
      width = Math.min(Math.max(grown, MIN_IMAGE_WIDTH), limit);
      image.style.width = `${width}px`;
      // The line changed height with the picture, which the editor has to measure again
      view.requestMeasure();
    };
    const stop = () => {
      handle.removeEventListener("pointermove", dragged);
      handle.removeEventListener("pointerup", released);
      handle.removeEventListener("pointercancel", cancelled);
    };
    const released = () => {
      stop();
      write((picture) => ({ width, alignment: picture.alignment }));
    };
    const cancelled = () => {
      stop();
      image.style.width = original;
      view.requestMeasure();
    };

    // The pointer keeps reaching the handle when the drag leaves the picture, where the editor would
    // otherwise take the press for one that places the cursor
    handle.setPointerCapture(event.pointerId);
    handle.addEventListener("pointermove", dragged);
    handle.addEventListener("pointerup", released);
    handle.addEventListener("pointercancel", cancelled);
  });

  return handle;
}

/** Left, center and right for the picture, the alignment it has reading as pressed. */
export function alignmentToolbar(
  view: EditorView,
  write: (change: (image: DocumentImage) => ImageSize) => void,
  size: ImageSize,
): HTMLElement {
  const toolbar = document.createElement("span");
  toolbar.className = cx("md-image-toolbar", toolbarStyle);
  const labels = t().editor.image;
  const choices: readonly { alignment: ImageAlignment; label: string }[] = [
    { alignment: "left", label: labels.alignLeft },
    { alignment: "center", label: labels.alignCenter },
    { alignment: "right", label: labels.alignRight },
  ];

  for (const { alignment, label } of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = cx("md-image-align", alignButton);
    button.setAttribute("data-alignment", alignment);
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(size.alignment === alignment));
    // A press keeps the cursor in the text; the button is not a place to type
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      write((image) => ({ width: image.width, alignment }));
      // The bar went away with the widget it was drawn in; the text takes the focus back
      view.focus();
    });
    toolbar.append(button);
  }

  return toolbar;
}
