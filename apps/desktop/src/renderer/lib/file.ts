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

/**
 * The folder that holds `path`, or undefined when it is the root of a file system or of a network
 * share. The separator style of the path is kept, so a path read from a window and one made here
 * still compare equal.
 */
export function parentFolder(path: string): string | undefined {
  const trimmed = path.replace(/[\\/]+$/, "");
  // A drive root ("C:"), a Unix root, or the server and share of a UNC path have nothing above
  if (/^[A-Za-z]:$/.test(trimmed) || trimmed === "" || /^\\\\[^\\]+(?:\\[^\\]+)?$/.test(trimmed)) {
    return undefined;
  }
  const cut = Math.max(trimmed.lastIndexOf("\\"), trimmed.lastIndexOf("/"));
  if (cut < 0) return undefined;
  // The folder just under a root keeps the root's own separator, "C:\" or "/"
  if (cut === 0) return trimmed.startsWith("/") ? "/" : trimmed.slice(0, 1);
  const parent = trimmed.slice(0, cut);
  return /^[A-Za-z]:$/.test(parent) ? `${parent}${trimmed[cut] ?? "\\"}` : parent;
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
