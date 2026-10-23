export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function isInsideFolder(folder: string, path: string): boolean {
  const normalize = (value: string) => value.replaceAll("\\", "/").replace(/\/+$/, "");
  return normalize(path).startsWith(`${normalize(folder)}/`);
}

/** Text files conventionally end with a newline; otherwise Git and similar tools warn "No newline at end of file". */
export function withTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}
