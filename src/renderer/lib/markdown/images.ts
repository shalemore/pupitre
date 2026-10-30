import { syntaxTree } from "@codemirror/language";
import { type EditorState, Facet } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { decodeUriPart } from "@shared/uri";
import { pathFromFileUrl } from "@/lib/file";
import { escapeHtml } from "@/lib/html";

/** file:// URL of the document's folder, to resolve relative image paths; undefined if unsaved. */
export const documentBaseUrl = Facet.define<string | undefined, string | undefined>({
  combine: (values) => values[0],
});

/** The path of the document on disk, for the file actions of its pictures; undefined if unsaved. */
export const documentFilePath = Facet.define<string | undefined, string | undefined>({
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
function imageSource(destination: string): string {
  return destination.replace(/^<(.*)>$/, "$1");
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
  const folder = pathFromFileUrl(url).replace(/\/+$/, "");
  return folder === "" ? "/" : folder;
}

/** Where the picture of an image address is: a file of this machine, or a page of the web. */
export type ImageOrigin =
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "remote"; readonly url: string };

const WEB_ADDRESS = /^https?:\/\//i;
/** A file the document names by its file:// address rather than a path. */
const FILE_ADDRESS = /^file:\/\//i;
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
  if (FILE_ADDRESS.test(src)) {
    let url: URL;
    try {
      url = new URL(src);
    } catch {
      return undefined;
    }
    if (url.protocol !== "file:") return undefined;
    return { kind: "file", path: pathFromFileUrl(url) };
  }
  // Any other scheme names something other than a picture this machine holds
  if (OTHER_ADDRESS.test(src) && !ABSOLUTE_PATH.test(src)) return undefined;
  const path = src.split("/").map(decodeUriPart).join("/");
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
  // Brackets and backslashes would end the alt text early
  const altText = alt.replace(/[\\[\]]/g, "\\$&");
  return `![${altText}](${/\s/.test(src) ? `<${src}>` : src})`;
}

/** The alt text of a picture picked from disk: its file name without the extension. */
export function imageAlt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/**
 * The bytes a base64 payload carries. `Uint8Array.fromBase64` would say this in one call, but Node
 * 24 (which runs the tests) and browsers from before 2025 do not have it, and the bytes have to be
 * read the same way in the app, the web demo and the tests.
 */
function base64Bytes(payload: string): Uint8Array {
  const binary = atob(payload);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/** The extension of the pictures a data: URL can carry, for a file saved from one. */
const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/avif": ".avif",
  "image/bmp": ".bmp",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
};

/**
 * The file a data: image carries, named after its alt text and its type, so it can be saved beside
 * the document. undefined when the address is not a data: URL or its bytes cannot be read.
 */
export function dataImageFile(src: string, alt: string): File | undefined {
  const header = /^data:([^,]*),(.*)$/s.exec(src);
  if (!header) return undefined;
  const [type = "application/octet-stream", ...parameters] = (header[1] ?? "").split(";");
  const payload = header[2] ?? "";
  let bytes: Uint8Array;
  try {
    bytes = parameters.includes("base64")
      ? base64Bytes(payload)
      : new TextEncoder().encode(decodeURIComponent(payload));
  } catch {
    return undefined;
  }
  const extension = MIME_EXTENSIONS[type.toLowerCase()] ?? "";
  return new File([bytes.slice()], `${alt === "" ? "image" : alt}${extension}`, { type });
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
  /** The title Markdown or the tag wrote beside the picture, empty when it has none. */
  readonly title: string;
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
    title: attributes.get("title") ?? "",
    width: width === undefined ? undefined : Number.parseInt(width, 10),
    alignment: alignmentOfStyle(attributes.get("style") ?? ""),
  };
}

/** The title of a Markdown image, whose node keeps the quotes it was written with. */
function titleText(source: string): string {
  const quote = source[0];
  return (quote === '"' || quote === "'") && source.endsWith(quote) ? source.slice(1, -1) : source;
}

/** The picture a Markdown image node draws. */
function markdownImage(state: EditorState, node: SyntaxNode): DocumentImage | undefined {
  const [open, close] = node.getChildren("LinkMark");
  const url = node.getChild("URL");
  if (!open || !close || !url) return undefined;
  const title = node.getChild("LinkTitle");
  return {
    from: node.from,
    to: node.to,
    src: imageSource(state.sliceDoc(url.from, url.to)),
    alt: state.sliceDoc(open.to, close.from),
    title: title === null ? "" : titleText(state.sliceDoc(title.from, title.to)),
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

/** The first picture whose source lies between `from` and `to`. */
function findImage(state: EditorState, from: number, to: number): DocumentImage | undefined {
  let found: DocumentImage | undefined;
  syntaxTree(state).iterate({
    from,
    to,
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

/**
 * The picture the widget that replaced its source stands for. The widget holds the place its source
 * begins, which is the picture itself unless a marker of a quote or a list comes first on the line.
 */
export function imageAt(state: EditorState, pos: number): DocumentImage | undefined {
  const line = state.doc.lineAt(pos);
  return findImage(state, pos, line.to);
}

/**
 * The first picture whose source lies in the range. A widget such as a table cell knows the range
 * it renders, so it can offer the picture menu without asking where a pointer maps in the text.
 */
export function imageIn(state: EditorState, from: number, to: number): DocumentImage | undefined {
  return findImage(state, from, to);
}

/** The range of the value of an attribute of an `<img>` tag written as `source`. */
function tagAttributeRange(
  source: string,
  attribute: string,
): { from: number; to: number } | undefined {
  for (const match of source.matchAll(TAG_ATTRIBUTE)) {
    if (match[1]?.toLowerCase() !== attribute) continue;
    const quoted = match[2] ?? match[3];
    const value = quoted ?? match[4];
    if (value === undefined) return undefined;
    // The match ends right after the value, so the range counts back from there
    const end = (match.index ?? 0) + match[0].length - (quoted === undefined ? 0 : 1);
    return { from: end - value.length, to: end };
  }
  return undefined;
}

/** The range of the value of the src attribute of the `<img>` tag written as `source`. */
function tagAddressRange(source: string): { from: number; to: number } | undefined {
  return tagAttributeRange(source, "src");
}

/**
 * The range the alt text of `image` covers: the text between the brackets of a Markdown image, or
 * the value of the alt attribute of an `<img>` tag.
 */
export function altRange(
  state: EditorState,
  image: DocumentImage,
): { from: number; to: number } | undefined {
  if (state.sliceDoc(image.from, image.from + 2) === "![") {
    return { from: image.from + 2, to: image.from + 2 + image.alt.length };
  }
  const range = tagAttributeRange(state.sliceDoc(image.from, image.to), "alt");
  return range && { from: image.from + range.from, to: image.from + range.to };
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
function imageMarkup(image: TaggedImage): string {
  const style = imageStyle(image);
  if (image.width === undefined && style === "") return imageMarkdown(image.alt, image.src);
  const width = image.width === undefined ? "" : ` width="${image.width}"`;
  const declarations = style === "" ? "" : ` style="${style}"`;
  const title = image.title === "" ? "" : ` title="${escapeHtml(image.title)}"`;
  return `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}"${title}${width}${declarations}>`;
}

/** Writes a size a known picture was changed to into its source, as one undoable change. */
export function setImageLayout(view: EditorView, image: DocumentImage, size: ImageSize): void {
  if (size.width === image.width && size.alignment === image.alignment) return;
  view.dispatch({
    changes: {
      from: image.from,
      to: image.to,
      insert: imageMarkup({ src: image.src, alt: image.alt, title: image.title, ...size }),
    },
    userEvent: "input.format",
  });
}
