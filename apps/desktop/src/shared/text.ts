/** The text with every line ending a file may carry turned into LF, which is what the editor works on. */
export function toLf(text: string): string {
  return text.replaceAll(/\r\n?/g, "\n");
}
