/**
 * Utility functions for CodeMirror syntax tree inspection and selection queries.
 */

export function rangeIntersectsSelection(
  from: number,
  to: number,
  ranges: readonly { from: number; to: number }[],
): boolean {
  for (const range of ranges) {
    if (Math.max(from, range.from) <= Math.min(to, range.to)) {
      return true;
    }
  }
  return false;
}
