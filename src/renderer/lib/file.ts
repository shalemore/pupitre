import { DOCUMENT_FILE } from "@shared/desktop-api";
import { decodeUriPart } from "@shared/uri";

export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** A document's name without its Markdown extension, for naming what is exported from it. */
export function withoutDocumentExtension(name: string): string {
  return name.replace(DOCUMENT_FILE, "");
}

// Unicode's left-to-right isolate and the mark that ends it, written as code points because
// the characters themselves are invisible
const LEFT_TO_RIGHT_ISOLATE = String.fromCodePoint(0x2066);
const POP_ISOLATE = String.fromCodePoint(0x2069);

/** A file name that reads left to right inside a longer text, without a right-to-left name reordering the text around it. */
export function isolateFileName(name: string): string {
  return `${LEFT_TO_RIGHT_ISOLATE}${name}${POP_ISOLATE}`;
}

/** A path written with forward slashes and without a trailing one, whatever it was written with. */
function slashed(path: string): string {
  return path.replaceAll("\\", "/").replace(/\/+$/, "");
}

export function isInsideFolder(folder: string, path: string): boolean {
  return slashed(path).startsWith(`${slashed(folder)}/`);
}

/** Where `path` sits under `folder`, or undefined when it is not inside it. */
export function relativeToFolder(folder: string, path: string): string | undefined {
  const root = slashed(folder);
  const full = slashed(path);
  return full.startsWith(`${root}/`) ? full.slice(root.length + 1) : undefined;
}

/**
 * The path a file: URL names. Its path starts with a slash before a Windows drive letter, and a
 * network share carries its server in the host, which a UNC path writes as a leading doubled slash.
 */
export function pathFromFileUrl(url: URL): string {
  const host = decodeUriPart(url.host);
  const path = decodeUriPart(url.pathname).replace(/^\/(?=[A-Za-z]:)/, "");
  return host === "" ? path : `//${host}${path}`;
}

/** Text files conventionally end with a newline; otherwise Git and similar tools warn "No newline at end of file". */
export function withTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}
