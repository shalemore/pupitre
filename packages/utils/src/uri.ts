/** `text` with its percent escapes read back; as it is where they are not valid escape text. */
export function decodeUriPart(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
