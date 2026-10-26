import { DOCUMENT_FILE } from "@shared/desktop-api";

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

export function isInsideFolder(folder: string, path: string): boolean {
  const normalize = (value: string) => value.replaceAll("\\", "/").replace(/\/+$/, "");
  return normalize(path).startsWith(`${normalize(folder)}/`);
}

/** Text files conventionally end with a newline; otherwise Git and similar tools warn "No newline at end of file". */
export function withTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}
