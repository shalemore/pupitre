import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Extension, Facet, Transaction } from "@codemirror/state";
import { EditorView, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { escapeHtml } from "@/lib/html";

/** file:// URL of the document's folder, to resolve relative image paths; undefined if unsaved. */
export const documentBaseUrl = Facet.define<string | undefined, string | undefined>({
  combine: (values) => values[0],
});

/** `url` made absolute against the document's folder, when it is relative and there is one. */
export function resolveAgainst(base: string | undefined, url: string): string {
  if (!base || URL.canParse(url)) return url;
  return new URL(url, base).href;
}

export function resolveUrl(state: EditorState, url: string): string {
  return resolveAgainst(state.facet(documentBaseUrl), url);
}

/** The address inside an image's parentheses, without the optional angle brackets. */
export function imageSource(destination: string): string {
  return destination.replace(/^<(.*)>$/, "$1");
}

/** `text` with its percent escapes read back; as it is where they are not valid escape text. */
function decoded(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * The folder of the document on disk, read from the file:// address its relative paths resolve
 * against; undefined while the document has no file, or in a window that has no file system.
 */
export function documentFolder(state: EditorState): string | undefined {
  const base = state.facet(documentBaseUrl);
  if (base === undefined) return undefined;
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return undefined;
  }
  if (url.protocol !== "file:") return undefined;
  // A file URL's path starts with a slash before a Windows drive letter
  const folder = decoded(url.pathname)
    .replace(/\/+$/, "")
    .replace(/^\/(?=[A-Za-z]:)/, "");
  return folder === "" ? "/" : folder;
}

/** Where the picture of an image address is: a file of this machine, or a page of the web. */
export type ImageOrigin =
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "remote"; readonly url: string };

const WEB_ADDRESS = /^https?:\/\//i;
/** The start of any other address that names a scheme of its own, such as data: or blob:. */
const OTHER_ADDRESS = /^[a-z][a-z0-9+.-]*:/i;
/** A path of this machine: a Windows drive, or the root of a Unix file system. */
const ABSOLUTE_PATH = /^(?:[a-z]:[\\/]|[\\/])/i;

/**
 * Where the address of a picture points, read against the document's `folder`. undefined for an
 * address no file action can reach, such as the data: of a picture pasted into a document that has
 * no file yet.
 */
export function imageOrigin(folder: string, src: string): ImageOrigin | undefined {
  if (WEB_ADDRESS.test(src)) return { kind: "remote", url: src };
  // Any other scheme, file: included, names something other than a picture this machine holds
  if (OTHER_ADDRESS.test(src) && !ABSOLUTE_PATH.test(src)) return undefined;
  const path = src.split("/").map(decoded).join("/");
  return { kind: "file", path: ABSOLUTE_PATH.test(src) ? path : `${folder}/${path}` };
}

function pathSegments(path: string): string[] {
  return path.split(/[\\/]+/).filter((segment) => segment !== "");
}

/** A Windows drive letter, the one segment of a path that reads the same in either case. */
function isDrive(segment: string | undefined): boolean {
  return /^[a-z]:$/i.test(segment ?? "");
}

/** How many segments from the start the two paths share. */
function sharedSegments(from: readonly string[], to: readonly string[]): number {
  let shared = 0;
  while (shared < from.length && shared < to.length) {
    const start = from[shared] ?? "";
    const end = to[shared] ?? "";
    const same =
      isDrive(start) || isDrive(end) ? start.toLowerCase() === end.toLowerCase() : start === end;
    if (!same) break;
    shared++;
  }
  return shared;
}

/** The segments of a path as one address, each encoded the way a Markdown destination is. */
function addressOf(segments: readonly string[]): string {
  return segments.map(encodeURIComponent).join("/");
}

/**
 * `path` written as the document links it: relative to its folder, with / between the segments and
 * each of them encoded. A picture on another drive has no such address and keeps its whole path.
 */
export function imageAddress(folder: string, path: string): string {
  const from = pathSegments(folder);
  const to = pathSegments(path);
  const shared = sharedSegments(from, to);
  if (shared === 0 && isDrive(from[0]) && isDrive(to[0])) return addressOf(to);
  const up = from.slice(shared).map(() => "..");
  return addressOf([...up, ...to.slice(shared)]);
}

/** The Markdown image that links `src` and reads as `alt`; an address holding spaces goes between angle brackets. */
export function imageMarkdown(alt: string, src: string): string {
  return `![${alt}](${/\s/.test(src) ? `<${src}>` : src})`;
}

/** The alt text of a picture picked from disk: its file name without the extension. */
export function imageAlt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/**
 * How a picture sits on its line. Markdown has no syntax for it, so a picture that is resized or
 * aligned becomes the inline HTML tag the same construct is written with in Typora.
 */
export type ImageAlignment = "left" | "center" | "right";

/**
 * The width in pixels and the alignment written beside a picture. Both are absent until the user
 * touches it: a plain `![alt](src)` image stays exactly as the Markdown wrote it.
 */
export interface ImageSize {
  readonly width: number | undefined;
  readonly alignment: ImageAlignment | undefined;
}

/** A picture as it is written: the address, the text read in its place, and its size. */
export interface TaggedImage extends ImageSize {
  readonly src: string;
  readonly alt: string;
}

/** A picture in the document, and the range its source covers. */
export interface DocumentImage extends TaggedImage {
  readonly from: number;
  readonly to: number;
}

/** An attribute of a tag, quoted or bare, as an inline `<img>` tag writes them. */
const TAG_ATTRIBUTE = /([a-z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;

const TAG_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
};

/** The text of an attribute, with the entities it was written with read back. */
function attributeText(value: string): string {
  return value.replace(
    /&(#39|amp|apos|gt|lt|quot);/g,
    (entity, name: string) => TAG_ENTITIES[name] ?? entity,
  );
}

const STYLE_DECLARATION = /([a-z-]+)\s*:\s*([^;]*)/gi;

/**
 * The alignment the margins of a style attribute declare: an image with a width only sits where the
 * text direction puts it, one that fills its line is aligned by the margins alone. Left is the start
 * edge, so the same declaration puts the picture on the right in a right-to-left document.
 */
function alignmentOfStyle(style: string): ImageAlignment | undefined {
  let start: string | undefined;
  let end: string | undefined;
  for (const [, property, value] of style.matchAll(STYLE_DECLARATION)) {
    const values = (value ?? "").trim().toLowerCase().split(/\s+/);
    const first = values[0];
    switch (property?.toLowerCase()) {
      // The two-value shorthand sets both sides; a single value sets them the same
      case "margin":
      case "margin-inline":
        start = first;
        end = values[1] ?? first;
        break;
      case "margin-inline-start":
        start = first;
        break;
      case "margin-inline-end":
        end = first;
        break;
      default:
        break;
    }
  }
  if (start === "auto" && end === "auto") return "center";
  if (start === "auto") return "right";
  if (end === "auto") return "left";
  return undefined;
}

/** A width as an image tag writes it: whole pixels, with the unit left out. */
const WIDTH_ATTRIBUTE = /^(\d+)(?:px)?$/;

/**
 * The picture an inline `<img>` tag draws, read from the tag as the Markdown wrote it; undefined for
 * any other tag, which stays source. The source has to hold that one tag: a line that starts with
 * one and goes on is HTML in the document, not a picture. Attributes a resize does not write are
 * left to the browser.
 */
export function parseImageTag(source: string): TaggedImage | undefined {
  if (!/^\s*<img\b[^>]*>\s*$/i.test(source)) return undefined;
  const attributes = new Map<string, string>();
  for (const [, name, quoted, single, bare] of source.matchAll(TAG_ATTRIBUTE)) {
    if (name) attributes.set(name.toLowerCase(), attributeText(quoted ?? single ?? bare ?? ""));
  }
  const src = attributes.get("src");
  if (src === undefined) return undefined;
  const width = WIDTH_ATTRIBUTE.exec(attributes.get("width") ?? "")?.[1];
  return {
    src,
    alt: attributes.get("alt") ?? "",
    width: width === undefined ? undefined : Number.parseInt(width, 10),
    alignment: alignmentOfStyle(attributes.get("style") ?? ""),
  };
}

/** The picture a Markdown image node draws. */
function markdownImage(state: EditorState, node: SyntaxNode): DocumentImage | undefined {
  const [open, close] = node.getChildren("LinkMark");
  const url = node.getChild("URL");
  if (!open || !close || !url) return undefined;
  return {
    from: node.from,
    to: node.to,
    src: imageSource(state.sliceDoc(url.from, url.to)),
    alt: state.sliceDoc(open.to, close.from),
    width: undefined,
    alignment: undefined,
  };
}

/** The picture a syntax node draws: a `![alt](src)` image, or an `<img>` tag, inline or on a line of its own. */
export function imageOf(state: EditorState, node: SyntaxNode): DocumentImage | undefined {
  if (node.name === "Image") return markdownImage(state, node);
  if (node.name !== "HTMLTag" && node.name !== "HTMLBlock") return undefined;
  const image = parseImageTag(state.sliceDoc(node.from, node.to));
  return image && { ...image, from: node.from, to: node.to };
}

/**
 * The picture the widget that replaced its source stands for. The widget holds the place its source
 * begins, which is the picture itself unless a marker of a quote or a list comes first on the line.
 */
export function imageAt(state: EditorState, pos: number): DocumentImage | undefined {
  const line = state.doc.lineAt(pos);
  let found: DocumentImage | undefined;
  syntaxTree(state).iterate({
    from: pos,
    to: line.to,
    enter: (node) => {
      if (found) return false;
      const image = imageOf(state, node.node);
      if (!image) return undefined;
      found = image;
      return false;
    },
  });
  return found;
}

/** The range of the value of the src attribute of the `<img>` tag written as `source`. */
function tagAddressRange(source: string): { from: number; to: number } | undefined {
  for (const match of source.matchAll(TAG_ATTRIBUTE)) {
    if (match[1]?.toLowerCase() !== "src") continue;
    const quoted = match[2] ?? match[3];
    const value = quoted ?? match[4];
    if (value === undefined) return undefined;
    // The match ends right after the value, so the range counts back from there
    const end = (match.index ?? 0) + match[0].length - (quoted === undefined ? 0 : 1);
    return { from: end - value.length, to: end };
  }
  return undefined;
}

/**
 * The range the address of `image` covers: the destination of a Markdown image, or the value of the
 * src attribute of an inline `<img>` tag. undefined once the text there is no longer the picture.
 */
export function addressRange(
  state: EditorState,
  image: DocumentImage,
): { from: number; to: number } | undefined {
  if (image.to > state.doc.length) return undefined;
  let range: { from: number; to: number } | undefined;
  syntaxTree(state).iterate({
    from: image.from,
    to: image.to,
    enter: (node) => {
      if (range !== undefined) return false;
      if (node.name === "URL" && node.node.parent?.name === "Image") {
        range = { from: node.from, to: node.to };
        return false;
      }
      return undefined;
    },
  });
  if (range !== undefined) return range;
  const tag = tagAddressRange(state.sliceDoc(image.from, image.to));
  return tag && { from: image.from + tag.from, to: image.from + tag.to };
}

/**
 * Points the picture of `image` at `src` by writing its address alone, so that the alt text, a title
 * and a width stay as they are; a file action leaves a link the reader did not change.
 */
export function relinkImage(view: EditorView, image: DocumentImage, src: string): void {
  const range = addressRange(view.state, image);
  if (range === undefined || view.state.sliceDoc(range.from, range.to) === src) return;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: src },
    userEvent: "input.format",
  });
}

/** The declarations that put a picture at its alignment, the ones its source carries. */
export function imageStyle(size: ImageSize): string {
  switch (size.alignment) {
    case "left":
      return "display:block;margin-inline:0 auto";
    case "center":
      return "display:block;margin-inline:auto";
    case "right":
      return "display:block;margin-inline:auto 0";
    default:
      return "";
  }
}

/** The Markdown for a picture: the image it was, until a width or an alignment is written beside it. */
export function imageMarkup(image: TaggedImage): string {
  const style = imageStyle(image);
  if (image.width === undefined && style === "") return imageMarkdown(image.alt, image.src);
  const width = image.width === undefined ? "" : ` width="${image.width}"`;
  const declarations = style === "" ? "" : ` style="${style}"`;
  return `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}"${width}${declarations}>`;
}

/** A picture narrower than this cannot be grabbed by its handle again. */
const MIN_IMAGE_WIDTH = 32;

/** The controls of a picture are not places to type, so the editor leaves their events alone. */
const CONTROLS = ".md-image-handle, .md-image-toolbar";

/**
 * Writes the width and alignment a control chose into the picture's source, as one change: the
 * caller says what changes, so a drag keeps the alignment and a button keeps the width.
 */
function writeImage(
  view: EditorView,
  block: HTMLElement,
  change: (image: DocumentImage) => ImageSize,
): void {
  const image = imageAt(view.state, view.posAtDOM(block));
  if (!image) return;
  const size = change(image);
  if (size.width === image.width && size.alignment === image.alignment) return;
  view.dispatch({
    changes: {
      from: image.from,
      to: image.to,
      insert: imageMarkup({ src: image.src, alt: image.alt, ...size }),
    },
    userEvent: "input.format",
  });
}

/**
 * The corner handle that sizes the picture. It drags the picture on the screen and writes the width
 * into its source once, when the pointer is released, so that one drag is one change to undo.
 */
function resizeHandle(
  view: EditorView,
  block: HTMLElement,
  frame: HTMLElement,
  image: HTMLImageElement,
): HTMLElement {
  const handle = document.createElement("span");
  handle.className = "md-image-handle";
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
      writeImage(view, block, (picture) => ({ width, alignment: picture.alignment }));
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
function alignmentToolbar(view: EditorView, block: HTMLElement, size: ImageSize): HTMLElement {
  const toolbar = document.createElement("span");
  toolbar.className = "md-image-toolbar";
  const labels = t().editor.image;
  const choices: readonly { alignment: ImageAlignment; label: string }[] = [
    { alignment: "left", label: labels.alignLeft },
    { alignment: "center", label: labels.alignCenter },
    { alignment: "right", label: labels.alignRight },
  ];

  for (const { alignment, label } of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "md-image-align";
    button.setAttribute("data-alignment", alignment);
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(size.alignment === alignment));
    // A press keeps the cursor in the text; the button is not a place to type
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      writeImage(view, block, (image) => ({ width: image.width, alignment }));
      // The bar went away with the widget it was drawn in; the text takes the focus back
      view.focus();
    });
    toolbar.append(button);
  }

  return toolbar;
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
  size: ImageSize,
  /** Whether the picture offers its controls; off while the selection shows its source. */
  controls: boolean,
): HTMLElement {
  const block = document.createElement("span");
  block.className = "md-image-block";
  // An aligned picture takes the whole line, so that its margins can place it on that line
  if (size.alignment !== undefined) block.setAttribute("data-alignment", size.alignment);

  const frame = document.createElement("span");
  frame.className = "md-image-frame";
  frame.style.cssText = imageStyle(size);

  const image = document.createElement("img");
  image.className = "md-image-preview";
  image.src = src;
  image.alt = alt;
  if (size.width !== undefined) image.style.width = `${size.width}px`;
  // The line grows once the picture arrives; let CodeMirror measure it again
  image.addEventListener("load", () => view.requestMeasure());

  frame.append(image);
  if (controls) {
    frame.append(resizeHandle(view, block, frame, image), alignmentToolbar(view, block, size));
  }
  block.append(frame);
  return block;
}

/** A picture in place of its source, with the handle and the bar that resize and align it. */
export class ImageWidget extends WidgetType {
  constructor(
    /** The address the picture is shown from, resolved against the document's folder. */
    readonly src: string,
    readonly alt: string,
    readonly size: ImageSize,
    /** Whether the picture offers its controls; off while the selection shows its source. */
    readonly controls: boolean,
  ) {
    super();
  }

  override eq(other: ImageWidget): boolean {
    return (
      other.src === this.src &&
      other.alt === this.alt &&
      other.size.width === this.size.width &&
      other.size.alignment === this.size.alignment &&
      other.controls === this.controls
    );
  }

  toDOM(view: EditorView): HTMLElement {
    return imageDom(view, this.src, this.alt, this.size, this.controls);
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

/** The type of a picked picture, kept on the File so a document without a file can show it before the save. */
const IMAGE_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
};

/** The image the user picked from disk, as the File a pasted picture arrives as; null when they dropped out of the dialog. */
export async function pickImage(): Promise<File | null> {
  const picked = await desktop.invoke("image:pick");
  if (picked === null) return null;
  const extension = picked.name.slice(picked.name.lastIndexOf(".") + 1).toLowerCase();
  const type = IMAGE_TYPES[extension] ?? "";
  // slice() gives the bytes an ArrayBuffer of their own, which is what a Blob takes
  return new File([picked.data.slice()], picked.name, { type });
}

/** Writes a pasted or dropped picture next to `documentPath` and returns the address to link it. */
export async function saveImageNextTo(documentPath: string, file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return desktop.invoke("document:save-image", documentPath, file.name, bytes);
}

interface PendingImage {
  file: File;
  /** Where the image was written, for the document path it was written for. */
  saved?: { documentPath: string; src: string };
}

/** A written image, by the blob: URL the document still links it with. */
interface ShownImage {
  url: string;
  src: string;
}

interface LinkChange {
  from: number;
  to: number;
  insert: string;
}

/** Every place in `text` that still shows the image by its blob: URL. */
function linkChanges(text: string, shown: readonly ShownImage[]): LinkChange[] {
  return shown.flatMap(({ url, src }) => {
    const changes: LinkChange[] = [];
    for (let at = text.indexOf(url); at >= 0; at = text.indexOf(url, at + url.length)) {
      changes.push({ from: at, to: at + url.length, insert: src });
    }
    return changes;
  });
}

/** `text` with every picture it still shows under a blob: URL linked to where it was written. */
function withWrittenImages(text: string, shown: readonly ShownImage[]): string {
  // Applied from the end, so no change moves the place of the ones before it
  return linkChanges(text, shown)
    .toSorted((a, b) => b.from - a.from)
    .reduce(
      (result, { from, to, insert }) => result.slice(0, from) + insert + result.slice(to),
      text,
    );
}

export interface PendingImages {
  /** Keeps `file` in memory and returns the blob: URL showing it until the document is written. */
  add: (file: File) => string;
  /**
   * Writes the images `markdown` still shows next to `documentPath`; returns the text linking them
   * there. The session writes a tab that is not on show with it, without the editor that shows it.
   */
  persistText: (markdown: string, documentPath: string) => Promise<string>;
  /** The same for the document an editor shows, linking the written images in place. */
  persistView: (view: EditorView, documentPath: string) => Promise<void>;
  dispose: () => void;
}

/**
 * Images pasted into a document that has no file yet. They are shown from blob: URLs and written
 * to the image folder when the document is first saved, so an unsaved document never embeds image
 * data in its Markdown.
 */
export function createPendingImages(): PendingImages {
  const images = new Map<string, PendingImage>();

  /** Writes the images `markdown` still shows, each once for the document path it belongs to. */
  const writeShown = async (markdown: string, documentPath: string): Promise<ShownImage[]> => {
    const shown = [...images].filter(([url]) => markdown.includes(url));
    return Promise.all(
      shown.map(async ([url, image]) => {
        const saved =
          image.saved?.documentPath === documentPath
            ? image.saved
            : { documentPath, src: await saveImageNextTo(documentPath, image.file) };
        image.saved = saved;
        return { url, src: saved.src };
      }),
    );
  };

  return {
    add: (file: File): string => {
      const url = URL.createObjectURL(file);
      images.set(url, { file });
      return url;
    },

    persistText: async (markdown, documentPath) => {
      const shown = await writeShown(markdown, documentPath);
      return withWrittenImages(markdown, shown);
    },

    persistView: async (view, documentPath) => {
      const before = view.state.doc.toString();
      const shown = await writeShown(before, documentPath);
      // Read the document again: it may have changed while the files were written
      const text = view.state.doc.toString();
      // Keep undo from bringing back the in-memory address; if it still does, the next save
      // links the image again
      view.dispatch({
        changes: linkChanges(text, shown),
        annotations: Transaction.addToHistory.of(false),
      });
    },

    dispose: () => {
      for (const url of images.keys()) URL.revokeObjectURL(url);
      images.clear();
    },
  };
}
