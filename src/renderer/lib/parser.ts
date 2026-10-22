import type { DocumentStats, HeadingItem } from "@/types";

export function extractHeadings(source: string): HeadingItem[] {
  const headings: HeadingItem[] = [];
  let pos = 0;
  for (const line of source.split("\n")) {
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (match?.[1] && match[2]) {
      headings.push({
        blockIndex: headings.length,
        level: match[1].length,
        title: match[2].trim(),
        pos,
      });
    }
    pos += line.length + 1;
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

/**
 * Detect text base direction by checking for strong RTL characters (Arabic, Hebrew, etc.)
 */
export function detectTextDirection(text: string): "ltr" | "rtl" {
  if (!text) return "ltr";
  const sample = text.slice(0, 4000);
  const rtlChars = sample.match(/[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/g)?.length ?? 0;
  return rtlChars > 25 ? "rtl" : "ltr";
}
