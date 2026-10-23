export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function dirnameOf(path: string): string | undefined {
  const end = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  // A root such as "/" or "C:\" keeps its separator; a bare name has no folder
  if (end < 0) return undefined;
  const parent = path.slice(0, end);
  return parent === "" || parent.endsWith(":") ? path.slice(0, end + 1) : parent;
}

export function isInsideFolder(folder: string, path: string): boolean {
  const normalize = (value: string) => value.replaceAll("\\", "/").replace(/\/+$/, "");
  return normalize(path).startsWith(`${normalize(folder)}/`);
}

/** Text files conventionally end with a newline; otherwise Git and similar tools warn "No newline at end of file". */
export function withTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}
