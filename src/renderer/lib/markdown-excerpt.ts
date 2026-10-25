/** Lines a folder shows under a file name. */
const PREVIEW_LINES = 2;

/** Lines that say nothing about the file: rules, table separators and images on their own. */
const NOISE = /^[\s|:-]+$|^!\[[^\]]*\]\([^)]*\)$/;

/**
 * The beginning of a Markdown text as one plain line, for the preview a folder shows under a file
 * name. It reads the source rather than rendering it, so it drops what would only be noise there:
 * front matter, fences, rules, table separators and images on a line of their own.
 */
export function excerptOf(markdown: string): string {
  const lines: string[] = [];
  let fenced = false;
  // Files written on Windows keep their CRLF in the bytes a preview reads
  const body = markdown.replaceAll("\r\n", "\n").replace(/^---\n[\s\S]*?\n---\n/, "");
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (/^(?:```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced || NOISE.test(line)) continue;
    const text = plainText(line);
    if (text === "") continue;
    lines.push(text);
    if (lines.length === PREVIEW_LINES) break;
  }
  return lines.join(" ");
}

/** What a line's inline markers are replaced with, in the order they are taken off. */
const INLINE_STEPS: readonly (readonly [RegExp, string])[] = [
  [/!?\[([^\]]*)\]\([^)]*\)/g, "$1"],
  [/`([^`]*)`/g, "$1"],
  [/\[\^[^\]]*\]/g, ""],
  [/<!--.*?-->/g, ""],
  [/<[^>]+>/g, ""],
  [/\${1,2}([^$]*)\${1,2}/g, "$1"],
  [/\\([\\`*_{}[\]()#+\-.!|])/g, "$1"],
  [/(\*\*|__|~~|==)/g, ""],
  // Emphasis inside a word is a literal character, so only markers at its edges go
  [/(?<![\p{L}\p{N}])([*_])|([*_])(?![\p{L}\p{N}])/gu, ""],
];

/** The text of one line of Markdown, without its markers. */
function plainText(line: string): string {
  const body = line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s?/, "")
    .replace(/^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, "");
  return INLINE_STEPS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    body,
  )
    .replace(/\s+/g, " ")
    .trim();
}
