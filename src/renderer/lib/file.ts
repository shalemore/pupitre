export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Text files conventionally end with a newline; otherwise Git and similar tools warn "No newline at end of file". */
export function withTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}
