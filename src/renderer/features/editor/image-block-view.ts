import { imageBlockSchema } from "@milkdown/kit/component/image-block";
import type { Node } from "@milkdown/kit/prose/model";
import type { EditorView, NodeView } from "@milkdown/kit/prose/view";
import { $view } from "@milkdown/kit/utils";

interface ImageBlockLabels {
  captionPlaceholder: string;
  sourcePlaceholder: string;
}

/** The caption row of an image without one appears only after the pointer rests on the image. */
const CAPTION_REVEAL_DELAY = 600;
const MIN_HEIGHT = 100;

function textAttr(node: Node, name: string): string {
  const value: unknown = node.attrs[name];
  return typeof value === "string" ? value : "";
}

function ratioAttr(node: Node): number {
  const value: unknown = node.attrs["ratio"];
  return typeof value === "number" ? value : 1;
}

/**
 * Replaces Milkdown's image block view, which edits the caption behind a toolbar icon and the
 * address through a separate upload form. Here the caption is a line under the image (always shown
 * when it has text, otherwise revealed on hover) and clicking the image swaps it for its source.
 * The markup is built by hand because a node view is a raw DOM extension point.
 */
function imageBlockView(resolveUrl: (url: string) => string, labels: ImageBlockLabels) {
  return (initial: Node, view: EditorView, getPos: () => number | undefined): NodeView => {
    let node = initial;
    // The height the image has at ratio 1, known once it has loaded
    let originHeight = 0;
    let revealTimer: number | undefined;

    const dom = document.createElement("div");
    dom.className = "milkdown-image-block";
    const wrapper = document.createElement("div");
    wrapper.className = "image-wrapper";
    const image = document.createElement("img");
    const resizeHandle = document.createElement("div");
    resizeHandle.className = "image-resize-handle";
    const caption = document.createElement("input");
    caption.className = "image-caption";
    caption.placeholder = labels.captionPlaceholder;
    const source = document.createElement("input");
    source.className = "image-source";
    source.placeholder = labels.sourcePlaceholder;
    source.spellcheck = false;
    wrapper.append(image, resizeHandle);
    dom.append(wrapper, caption, source);

    for (const input of [caption, source]) {
      // The block is draggable while selected; without this, selecting text in the input drags the block
      input.draggable = true;
      input.addEventListener("dragstart", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    }

    const setAttr = (name: string, value: string | number) => {
      const pos = getPos();
      if (pos === undefined || !view.editable) return;
      view.dispatch(view.state.tr.setNodeAttribute(pos, name, value));
    };

    const applyHeight = () => {
      if (originHeight > 0) image.style.height = `${originHeight * ratioAttr(node)}px`;
    };

    const sync = () => {
      const resolved = resolveUrl(textAttr(node, "src"));
      if (image.getAttribute("src") !== resolved) image.src = resolved;
      image.alt = textAttr(node, "alt") || textAttr(node, "caption");
      const text = textAttr(node, "caption");
      if (caption.value !== text) caption.value = text;
      dom.classList.toggle("has-caption", text !== "");
      applyHeight();
    };

    image.addEventListener("load", () => {
      const maxWidth = dom.getBoundingClientRect().width;
      if (maxWidth === 0) return;
      const { naturalWidth, naturalHeight } = image;
      originHeight =
        naturalWidth < maxWidth ? naturalHeight : maxWidth * (naturalHeight / naturalWidth);
      applyHeight();
    });

    resizeHandle.addEventListener("pointerdown", (event) => {
      if (!view.editable) return;
      event.preventDefault();
      event.stopPropagation();
      const top = image.getBoundingClientRect().top;
      const drag = new AbortController();
      window.addEventListener(
        "pointermove",
        (move) => {
          move.preventDefault();
          image.style.height = `${Math.max(move.clientY - top, MIN_HEIGHT)}px`;
        },
        { signal: drag.signal },
      );
      window.addEventListener(
        "pointerup",
        () => {
          drag.abort();
          if (originHeight > 0) {
            setAttr(
              "ratio",
              Number((image.getBoundingClientRect().height / originHeight).toFixed(2)),
            );
          }
        },
        { signal: drag.signal },
      );
    });

    const editSource = () => {
      if (!view.editable) return;
      source.value = textAttr(node, "src");
      dom.classList.add("is-editing-source");
      source.focus();
      source.select();
    };

    const closeSource = (commit: boolean) => {
      if (!dom.classList.contains("is-editing-source")) return;
      dom.classList.remove("is-editing-source");
      const value = source.value.trim();
      if (commit && value !== "" && value !== textAttr(node, "src")) setAttr("src", value);
    };

    image.addEventListener("click", editSource);
    source.addEventListener("blur", () => closeSource(true));
    source.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== "Escape") return;
      event.preventDefault();
      closeSource(event.key === "Enter");
      view.focus();
    });

    caption.addEventListener("input", () => setAttr("caption", caption.value));
    caption.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== "Escape") return;
      event.preventDefault();
      view.focus();
    });
    caption.addEventListener("blur", () => {
      if (!dom.matches(":hover")) dom.classList.remove("reveal-caption");
    });

    dom.addEventListener("pointerenter", () => {
      if (!view.editable) return;
      revealTimer = window.setTimeout(
        () => dom.classList.add("reveal-caption"),
        CAPTION_REVEAL_DELAY,
      );
    });
    dom.addEventListener("pointerleave", () => {
      window.clearTimeout(revealTimer);
      if (document.activeElement !== caption) dom.classList.remove("reveal-caption");
    });

    sync();
    // An image without an address has nothing to show, so it opens straight on its source
    if (textAttr(node, "src") === "") requestAnimationFrame(editSource);

    return {
      dom,
      update: (updated) => {
        if (updated.type !== initial.type) return false;
        node = updated;
        sync();
        return true;
      },
      stopEvent: (event) =>
        event.target instanceof HTMLInputElement || event.target === resizeHandle,
      ignoreMutation: () => true,
      selectNode: () => dom.classList.add("selected"),
      deselectNode: () => dom.classList.remove("selected"),
      destroy: () => window.clearTimeout(revealTimer),
    };
  };
}

export function editableImageBlock(resolveUrl: (url: string) => string, labels: ImageBlockLabels) {
  return $view(imageBlockSchema.node, () => imageBlockView(resolveUrl, labels));
}
