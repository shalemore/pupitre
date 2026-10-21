import type { Block, DocumentStats, HeadingItem } from "@/types";

export function parseBlocks(source: string): Block[] {
  if (!source) {
    return [];
  }

  const lines = source.split(/\r?\n/);
  const blocks: Block[] = [];
  let currentOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const start = currentOffset;
    const end = start + line.length;
    currentOffset = end + 1;

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch && headingMatch[1] && headingMatch[2]) {
      blocks.push({
        id: `block-${blocks.length}`,
        type: "heading",
        raw: line,
        sourceRange: [start, end],
        headingLevel: headingMatch[1].length,
        headingText: headingMatch[2].trim(),
      });
    } else {
      blocks.push({
        id: `block-${blocks.length}`,
        type: "paragraph",
        raw: line,
        sourceRange: [start, end],
      });
    }
  }

  return blocks;
}

export function extractHeadings(sourceOrBlocks: string | Block[]): HeadingItem[] {
  if (typeof sourceOrBlocks === "string") {
    const headings: HeadingItem[] = [];
    const lines = sourceOrBlocks.split(/\r?\n/);
    let currentPos = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match && match[1] && match[2]) {
        headings.push({
          blockIndex: headings.length,
          level: match[1].length,
          title: match[2].trim(),
          pos: currentPos,
        });
      }
      currentPos += line.length + 1;
    }
    return headings;
  }

  const headings: HeadingItem[] = [];
  for (let i = 0; i < sourceOrBlocks.length; i++) {
    const block = sourceOrBlocks[i];
    if (!block) continue;
    if (block.headingLevel && block.headingText) {
      headings.push({
        blockIndex: headings.length,
        level: block.headingLevel,
        title: block.headingText.trim(),
        pos: block.sourceRange[0],
      });
    }
  }
  return headings;
}

export function calculateStats(source: string): DocumentStats {
  if (!source.trim()) {
    return { words: 0, chars: 0 };
  }

  // Count individual CJK characters as words, and whitespace/hyphen-separated Latin tokens
  const wordsMatch = source.match(/[\u4e00-\u9fa5]|\b[a-zA-Z0-9_-]+\b/g);
  const words = wordsMatch ? wordsMatch.length : 0;
  const chars = source.replace(/\s+/g, "").length;

  return { words, chars };
}
