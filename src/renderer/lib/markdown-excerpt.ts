import type { SyntaxNode, Tree } from "@lezer/common";
import { readableTextFrom } from "@/features/editor/document-structure";
import { markdownParser } from "@/features/editor/markdown-language";

/** Lines a folder shows under a file name. */
const PREVIEW_LINES = 2;

/** Blocks whose source a preview does not repeat. */
const SKIPPED_BLOCK = /^(?:FencedCode|CodeBlock|FrontMatter|HTMLBlock|CommentBlock)$/;

/**
 * The beginning of a Markdown text as one plain line, for the preview a folder shows under a file
 * name. The editor's parser drops the syntax a reader never sees; code, front matter and HTML
 * blocks are left out.
 */
export function excerptOf(markdown: string): string {
  // Files written on Windows keep their CRLF in the bytes a preview reads
  const source = markdown.replaceAll("\r\n", "\n");
  const tree = markdownParser.parse(source);
  const lines: string[] = [];
  let from = 0;
  while (from <= source.length && lines.length < PREVIEW_LINES) {
    const newline = source.indexOf("\n", from);
    const to = newline === -1 ? source.length : newline;
    if (!inSkippedBlock(tree, from)) {
      const text = readableTextFrom(tree, (start, end) => source.slice(start, end), from, to)
        .replace(/\s+/g, " ")
        .trim();
      if (text !== "") lines.push(text);
    }
    if (newline === -1) break;
    from = newline + 1;
  }
  return lines.join(" ");
}

function inSkippedBlock(tree: Tree, pos: number): boolean {
  for (let node: SyntaxNode | null = tree.resolveInner(pos, 1); node !== null; node = node.parent) {
    if (SKIPPED_BLOCK.test(node.name)) return true;
  }
  return false;
}
