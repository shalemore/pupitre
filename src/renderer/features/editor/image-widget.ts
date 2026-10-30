import type { Extension } from "@codemirror/state";
import { EditorView, WidgetType } from "@codemirror/view";
import { t } from "@/i18n";
import {
  type DocumentImage,
  type ImageAlignment,
  type ImageSize,
  addressRange,
  altRange,
  imageAt,
  imageMarkdown,
  imageStyle,
  resolveAgainst,
  setImageLayout,
} from "@/lib/markdown/images";
import { css, cx } from "@/styled-system/css";
import { hasTransparency } from "./image-alpha";

/** A picture narrower than this cannot be grabbed by its handle again. */
const MIN_IMAGE_WIDTH = 32;

/** The controls of a picture are not places to type, so the editor leaves their events alone. */
const CONTROLS = ".md-image-handle, .md-image-toolbar, .md-image-retry, .md-image-caption-hint";

/** A picture fetched from the web, whose absence may be the network's fault rather than its own. */
const WEB_IMAGE = /^https?:\/\//i;

/** The room the bar of a picture keeps from the edges of its frame, in pixels at the root size. */
const TOOLBAR_INSET = 6;

/** How long a picture may take before a placeholder stands in for it. */
const SLOW_LOAD_DELAY = 500;

/** How long a failed download waits before each of its three tries, longer every time. */
const RETRY_DELAYS = [1000, 2000, 4000] as const;

/** The pictures whose download failed and that wait for the network, by the retry they run. */
const waitingForNetwork = new Set<() => boolean>();
let watchesNetwork = false;

/**
 * Runs `retry` once the network comes back, for a picture that could not be downloaded. The retry
 * gives back whether it still needs the network, so a picture that is gone or loaded leaves the set.
 */
function retryWhenNetworkReturns(retry: () => boolean): void {
  waitingForNetwork.add(retry);
  if (watchesNetwork) return;
  watchesNetwork = true;
  window.addEventListener("online", () => {
    for (const waiting of waitingForNetwork) {
      if (!waiting()) waitingForNetwork.delete(waiting);
    }
  });
}

function writeImage(
  view: EditorView,
  block: HTMLElement,
  change: (image: DocumentImage) => ImageSize,
): void {
  const image = imageAt(view.state, view.posAtDOM(block));
  if (!image) return;
  setImageLayout(view, image, change(image));
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
function resizeHandle(
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
function alignmentToolbar(
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

/** Watches a picture load, showing the skeleton while it is slow and the retry when it fails. */
function watchImage(
  view: EditorView,
  image: HTMLImageElement,
  frame: HTMLElement,
  src: string,
): void {
  const skeleton = document.createElement("span");
  skeleton.className = "md-image-skeleton";
  const message = document.createElement("span");
  message.className = "md-image-fallback-message";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "md-image-retry";
  retry.textContent = t().editor.image.retry;
  const fallback = document.createElement("span");
  fallback.className = "md-image-fallback";
  fallback.append(message, retry);

  frame.setAttribute("data-state", "loading");
  frame.append(skeleton, fallback);

  const remote = WEB_IMAGE.test(src);
  const attributeWidth = Number(image.getAttribute("width"));
  const styleWidth = Number.parseFloat(image.style.width);
  let knownWidth = attributeWidth || (Number.isFinite(styleWidth) ? styleWidth : 0);
  let knownHeight = Number(image.getAttribute("height")) || 0;
  let loaded = false;
  let failed = false;
  let attempts = 0;
  let slowTimer: number | undefined;

  const showSkeleton = () => {
    window.clearTimeout(slowTimer);
    slowTimer = window.setTimeout(() => {
      if (!loaded && image.isConnected) frame.setAttribute("data-slow", "");
    }, SLOW_LOAD_DELAY);
  };

  const settle = (state: "ready" | "error") => {
    window.clearTimeout(slowTimer);
    frame.removeAttribute("data-slow");
    frame.setAttribute("data-state", state);
    view.requestMeasure();
  };

  /** Fetches the picture; a retry keeps the failure message up until the answer arrives. */
  const load = (retrying = false) => {
    if (!image.isConnected) return;
    loaded = false;
    window.clearTimeout(slowTimer);
    frame.removeAttribute("data-slow");
    if (!retrying) {
      frame.setAttribute("data-state", "loading");
      showSkeleton();
    }
    image.src = src;
  };

  // A download that failed once is tried again when the network comes back, without the user
  // having to notice that it went away
  const retryWhenOnline = () => {
    if (!image.isConnected || !failed) return false;
    failed = false;
    attempts = 0;
    load(true);
    return false;
  };

  image.addEventListener("load", () => {
    loaded = true;
    failed = false;
    attempts = 0;
    knownWidth = image.naturalWidth || knownWidth;
    knownHeight = image.naturalHeight || knownHeight;
    frame.style.removeProperty("inline-size");
    frame.style.removeProperty("min-block-size");
    settle("ready");
    // A picture with a clear background, an icon for one, keeps its own outline instead of
    // standing in a frame that would box it in
    frame.toggleAttribute("data-alpha", hasTransparency(image));
    // The line changes as the picture arrives, or as its frame gives way to its outline
    view.requestMeasure();
  });

  image.addEventListener("error", () => {
    if (loaded || !image.isConnected) return;
    if (remote) retryWhenNetworkReturns(retryWhenOnline);
    const delay = RETRY_DELAYS[attempts];
    if (remote && delay !== undefined) {
      attempts += 1;
      window.setTimeout(() => load(true), delay);
      return;
    }
    failed = true;
    message.textContent = remote ? t().editor.image.failedNetwork : t().editor.image.failedFile;
    // Keep the space the picture would take, so retrying it does not move the page
    if (knownWidth > 0) frame.style.inlineSize = `${knownWidth}px`;
    if (knownHeight > 0) frame.style.minBlockSize = `${knownHeight}px`;
    settle("error");
  });

  retry.addEventListener("mousedown", (event) => event.preventDefault());
  retry.addEventListener("click", () => {
    failed = false;
    attempts = 0;
    load(true);
  });

  showSkeleton();
  image.src = src;
}

/**
 * A picture and its controls, as the widget that replaces its source draws it. The frame carries the
 * declarations its source carries, so the document reads the same here and on a page.
 */
export function imageDom(
  view: EditorView,
  /** The address the picture is shown from, resolved against the document's folder. */
  src: string,
  alt: string,
  title: string,
  size: ImageSize,
  /** Whether the picture offers its controls; off while the selection shows its source. */
  controls: boolean,
  /**
   * The caption a picture that has none in its source shows under it, such as the alt text of an
   * `<img>` tag; a Markdown image leaves it out, since its own alt text is the caption line.
   */
  caption?: string,
  /** Where a change goes; the default finds the picture from the DOM it replaced. */
  write?: (change: (image: DocumentImage) => ImageSize) => void,
  /** Whether the picture shares its line with text instead of taking a line of its own. */
  inline = false,
): HTMLElement {
  const block = document.createElement("span");
  block.className = "md-image-block";
  if (inline) block.setAttribute("data-inline", "");
  // An aligned picture takes the whole line, so that its margins can place it on that line
  if (size.alignment !== undefined) block.setAttribute("data-alignment", size.alignment);

  const frame = document.createElement("span");
  // The controls show while the pointer is on the frame, which its group variant marks
  frame.className = "md-image-frame group";
  frame.style.cssText = imageStyle(size);

  const image = document.createElement("img");
  image.className = "md-image-preview";
  image.alt = alt;
  image.title = title;
  if (size.width !== undefined) image.style.width = `${size.width}px`;

  frame.append(image);
  watchImage(view, image, frame, src);

  // The picture shows its source, so a click edits it at the end of its address rather than
  // placing a cursor by coordinates; the controls keep their own events
  const editSource = (event: MouseEvent, place: (image: DocumentImage) => number | undefined) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest(CONTROLS)) return;
    event.preventDefault();
    event.stopPropagation();
    const picture = imageAt(view.state, view.posAtDOM(block));
    if (picture === undefined) return;
    view.focus();
    view.dispatch({
      selection: { anchor: place(picture) ?? picture.from },
      scrollIntoView: true,
    });
  };
  frame.addEventListener("mousedown", (event) => {
    editSource(event, (picture) => addressRange(view.state, picture)?.to);
  });

  if (controls) {
    const commit = write ?? ((change) => writeImage(view, block, change));
    const toolbar = alignmentToolbar(view, commit, size);
    frame.append(resizeHandle(view, block, commit, frame, image), toolbar);
    // A picture narrower than its bar cannot hold the bar inside; the bar hangs under it instead
    const placeToolbar = () => {
      frame.toggleAttribute(
        "data-toolbar-outside",
        toolbar.offsetWidth > 0 && frame.clientWidth < toolbar.offsetWidth + 2 * TOOLBAR_INSET,
      );
    };
    // The frame has its size once it is on the page, and the picture changes that size on load
    requestAnimationFrame(placeToolbar);
    image.addEventListener("load", placeToolbar);
  }
  block.append(frame);

  if (caption !== undefined && caption !== "") {
    const label = document.createElement("span");
    label.className = "md-image-caption";
    label.textContent = caption;
    label.addEventListener("mousedown", (event) => {
      editSource(event, (picture) => altRange(view.state, picture)?.to);
    });
    block.append(label);
  }

  // A picture with no caption gets a quiet offer to write one, shown once the pointer rests on it.
  // Writing it puts the caret between the brackets of the image, whose source then shows around it
  if (controls && alt === "" && caption === undefined) {
    const hint = document.createElement("button");
    hint.type = "button";
    hint.className = "md-image-caption-hint";
    hint.textContent = t().editor.image.addCaption;
    hint.addEventListener("mousedown", (event) => event.preventDefault());
    hint.addEventListener("click", () => {
      const picture = imageAt(view.state, view.posAtDOM(block));
      if (picture === undefined) return;
      view.focus();
      view.dispatch({
        selection: { anchor: picture.from + 2 },
        scrollIntoView: true,
      });
    });
    block.append(hint);
  }

  return block;
}

/** A picture written as HTML, keeping its element and attributes and adding the loading state. */
function watchHtmlImage(view: EditorView, image: HTMLImageElement, src: string): void {
  const block = document.createElement("span");
  block.className = "md-image-block";
  block.setAttribute("data-inline", "");
  const frame = document.createElement("span");
  frame.className = "md-image-frame";
  block.append(frame);
  image.classList.add("md-image-preview");
  image.removeAttribute("src");
  image.replaceWith(block);
  frame.append(image);
  watchImage(view, image, frame, src);
}

/** Gives every picture of a rendered HTML block the loading state a Markdown picture has. */
export function watchHtmlImages(
  view: EditorView,
  root: ParentNode,
  base: string | undefined,
): void {
  for (const image of root.querySelectorAll<HTMLImageElement>("img")) {
    watchHtmlImage(view, image, resolveAgainst(base, image.getAttribute("src") ?? ""));
  }
}

/** A picture in place of its source, with the handle and the bar that resize and align it. */
export class ImageWidget extends WidgetType {
  constructor(
    /** The address the picture is shown from, resolved against the document's folder. */
    readonly src: string,
    readonly alt: string,
    readonly title: string,
    readonly size: ImageSize,
    /** Whether the picture offers its controls; off while the selection shows its source. */
    readonly controls: boolean,
    /** Whether the picture shares its line with text instead of taking a line of its own. */
    readonly inline = false,
  ) {
    super();
  }

  override eq(other: ImageWidget): boolean {
    return (
      other.src === this.src &&
      other.alt === this.alt &&
      other.title === this.title &&
      other.size.width === this.size.width &&
      other.size.alignment === this.size.alignment &&
      other.controls === this.controls &&
      other.inline === this.inline
    );
  }

  toDOM(view: EditorView): HTMLElement {
    return imageDom(
      view,
      this.src,
      this.alt,
      this.title,
      this.size,
      this.controls,
      undefined,
      undefined,
      this.inline,
    );
  }

  // Clicking the picture places the cursor there, which reveals its source; its controls are not
  // places to put the cursor
  override ignoreEvent(event: Event): boolean {
    return event.target instanceof Element && event.target.closest(CONTROLS) !== null;
  }
}

function imageFiles(data: DataTransfer | null): File[] {
  return [...(data?.files ?? [])].filter((file) => file.type.startsWith("image/"));
}

/**
 * A Markdown picture's caption is its alt text in the source; a click in it edits that text at its
 * end, as a click on the picture edits its address.
 */
export function imageCaptionClick(): Extension {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (event.button !== 0) return false;
      const target = event.target;
      if (!(target instanceof Element)) return false;
      const line = target.closest(".cm-line.md-image-caption");
      if (line === null || target.closest(".md-image-block") !== null) return false;
      const pos = view.posAtCoords(event);
      if (pos === null) return false;
      const picture = imageAt(view.state, pos);
      if (picture === undefined) return false;
      const alt = altRange(view.state, picture);
      if (alt === undefined || pos < alt.from || pos > alt.to) return false;
      event.preventDefault();
      view.focus();
      view.dispatch({ selection: { anchor: alt.to }, scrollIntoView: true });
      return true;
    },
  });
}

/**
 * Pasted and dropped pictures are stored by `upload`, which returns the address to link, and
 * inserted as Markdown images. Other dropped files are left to the window, which opens them.
 */
export function imageInput(upload: (file: File) => Promise<string>): Extension {
  const insert = async (view: EditorView, files: File[], pos: number) => {
    const sources = await Promise.all(files.map(upload));
    const text = sources.map((src) => imageMarkdown("", src)).join("\n");
    const at = Math.min(pos, view.state.doc.length);
    view.dispatch({
      changes: { from: at, insert: text },
      selection: { anchor: at + text.length },
      userEvent: "input.paste",
    });
  };

  return EditorView.domEventHandlers({
    paste(event, view) {
      const files = imageFiles(event.clipboardData);
      if (files.length === 0) return false;
      event.preventDefault();
      const { from, to } = view.state.selection.main;
      if (to > from) view.dispatch({ changes: { from, to }, userEvent: "delete" });
      void insert(view, files, from);
      return true;
    },
    drop(event, view) {
      if (!event.dataTransfer?.files.length) return false;
      const files = imageFiles(event.dataTransfer);
      if (files.length === 0) return true;
      event.preventDefault();
      const pos = view.posAtCoords(event) ?? view.state.selection.main.head;
      void insert(view, files, pos);
      return true;
    },
  });
}
