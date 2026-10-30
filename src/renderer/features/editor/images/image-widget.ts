import type { Extension } from "@codemirror/state";
import { EditorView, WidgetType } from "@codemirror/view";
import { t } from "@/i18n";
import {
  type DocumentImage,
  type ImageSize,
  addressRange,
  altRange,
  imageAt,
  imageMarkdown,
  imageStyle,
  resolveAgainst,
  setImageLayout,
} from "@/lib/markdown/images";
import { alignmentToolbar, resizeHandle, TOOLBAR_INSET } from "./image-controls";
import { watchImage } from "./image-loading";

/** The controls of a picture are not places to type, so the editor leaves their events alone. */
const CONTROLS = ".md-image-handle, .md-image-toolbar, .md-image-retry, .md-image-caption-hint";

function writeImage(
  view: EditorView,
  block: HTMLElement,
  change: (image: DocumentImage) => ImageSize,
): void {
  const image = imageAt(view.state, view.posAtDOM(block));
  if (!image) return;
  setImageLayout(view, image, change(image));
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
