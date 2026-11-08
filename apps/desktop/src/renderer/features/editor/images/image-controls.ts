import type { EditorView } from "@codemirror/view";
import { t } from "@pupitre/i18n/solid";
import {
  type DocumentImage,
  type ImageAlignment,
  type ImageSize,
  imageAt,
} from "@pupitre/markdown";
import { relabelOnLocaleChange } from "@/features/editor/widgets/relabel-on-locale";
import { css, cx } from "@/styled-system/css";
import { applyImageWidth } from "./image-geometry";

/**
 * The controls of a picture: the corner handle that resizes it and the bar that aligns it. Both
 * write their choice into the source as one change.
 */

/** A picture narrower than this cannot be grabbed by its handle again. */
const MIN_IMAGE_WIDTH = 32;

/** How far one arrow key resizes the picture, in pixels at the root size. */
const KEYBOARD_STEP = 16;

/** The room the bar of a picture keeps from the edges of its frame, in pixels at the root size. */
export const TOOLBAR_INSET = 6;

/**
 * Puts the focus on the handle the written picture is drawn with, after the source change replaced
 * the one that had it. Falls back to the text when the picture has no controls anymore.
 */
function focusNewHandle(view: EditorView, pos: number): void {
  requestAnimationFrame(() => {
    const at = view.domAtPos(pos);
    const node = at.node instanceof Element ? at.node : at.node.parentElement;
    const block = node?.closest(".md-image-block") ?? node?.querySelector(".md-image-block");
    const handle = block?.querySelector(".md-image-handle");
    if (handle instanceof HTMLElement) handle.focus();
    else view.focus();
  });
}

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
  pointerEvents: "none",
  _groupHover: { opacity: 1, pointerEvents: "auto" },
  _groupFocusWithin: { opacity: 1, pointerEvents: "auto" },
  _focusVisible: { boxShadow: "focus" },
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
  pointerEvents: "none",
  _groupHover: { opacity: 1, pointerEvents: "auto" },
  _groupFocusWithin: { opacity: 1, pointerEvents: "auto" },
});
const alignButton = css({
  display: "grid",
  width: "6",
  height: "6",
  placeItems: "center",
  borderRadius: "md",
  borderWidth: "[0]",
  backgroundColor: "transparent",
  padding: "0",
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
  image: HTMLImageElement,
): HTMLElement {
  const handle = document.createElement("span");
  // Interface rather than document, sized in rem like the corner of a code block
  handle.className = cx("md-image-handle", handleStyle);
  handle.tabIndex = 0;
  handle.setAttribute("role", "button");
  relabelOnLocaleChange(handle, () => {
    const text = t().editor.image.resize;
    handle.title = text;
    handle.setAttribute("aria-label", text);
  });

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    // The drag is not a gesture the line has to select text for
    event.preventDefault();
    const start = event.clientX;
    // The picture's own width, without the frame's padding, which a written width does not carry
    const startWidth = image.getBoundingClientRect().width;
    // The line the picture stands on, which a picture of its own size is narrower than
    const room = (block.parentElement ?? block).getBoundingClientRect().width;
    // An unmeasured line puts no limit on the width
    const limit = room > 0 ? Math.round(room) : Number.POSITIVE_INFINITY;
    const original = image.style.width === "" ? undefined : Number.parseFloat(image.style.width);
    // The handle hangs at the end of the line, which is the left edge of a right-to-left document
    const step = getComputedStyle(image).direction === "rtl" ? -1 : 1;
    let width = Math.round(startWidth);

    const dragged = (move: PointerEvent) => {
      const grown = Math.round(startWidth + (move.clientX - start) * step);
      width = Math.min(Math.max(grown, MIN_IMAGE_WIDTH), limit);
      applyImageWidth(image, width);
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
      applyImageWidth(image, original);
      view.requestMeasure();
    };

    // The pointer keeps reaching the handle when the drag leaves the picture, where the editor would
    // otherwise take the press for one that places the cursor
    handle.setPointerCapture(event.pointerId);
    handle.addEventListener("pointermove", dragged);
    handle.addEventListener("pointerup", released);
    handle.addEventListener("pointercancel", cancelled);
  });

  // The arrow keys take the same step a drag does, towards the edge the handle hangs at
  handle.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const picture = imageAt(view.state, view.posAtDOM(block));
    if (picture === undefined) return;
    const room = (block.parentElement ?? block).getBoundingClientRect().width;
    const limit = room > 0 ? Math.round(room) : Number.POSITIVE_INFINITY;
    const current = Math.round(image.getBoundingClientRect().width);
    const rtl = getComputedStyle(image).direction === "rtl";
    const grows = (event.key === "ArrowRight") !== rtl;
    const next = Math.min(
      Math.max(current + (grows ? KEYBOARD_STEP : -KEYBOARD_STEP), MIN_IMAGE_WIDTH),
      limit,
    );
    if (next === current) return;
    applyImageWidth(image, next);
    view.requestMeasure();
    write((size) => ({ width: next, alignment: size.alignment }));
    // The source changed, so this handle went with the widget it was drawn in; the arrow keeps
    // resizing until the user leaves the controls
    focusNewHandle(view, picture.from);
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
  const choices: readonly { alignment: ImageAlignment; label: () => string }[] = [
    { alignment: "left", label: () => t().editor.image.alignLeft },
    { alignment: "center", label: () => t().editor.image.alignCenter },
    { alignment: "right", label: () => t().editor.image.alignRight },
  ];

  for (const { alignment, label } of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = cx("md-image-align", alignButton);
    button.setAttribute("data-alignment", alignment);
    relabelOnLocaleChange(button, () => {
      const text = label();
      button.title = text;
      button.setAttribute("aria-label", text);
    });
    button.setAttribute("aria-pressed", String(size.alignment === alignment));
    // A press keeps the cursor in the text; the button is not a place to type
    button.addEventListener("mousedown", (event) => event.preventDefault());
    // A button inside the editable document is not activated by Enter or Space on its own
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      button.click();
    });
    button.addEventListener("click", () => {
      write((image) => ({ width: image.width, alignment }));
      // The bar went away with the widget it was drawn in; the text takes the focus back
      view.focus();
    });
    toolbar.append(button);
  }

  return toolbar;
}
