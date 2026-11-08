import type { FolderEntry } from "@pupitre/desktop-api";
import { nameCollator } from "./name-collator";

/** What an entry that the host cannot date sorts as: the end of the list. */
export const UNTIMED = Number.MIN_SAFE_INTEGER;

/** One entry with the time the sort reads. */
interface TimedEntry {
  entry: FolderEntry;
  time: number;
}

/**
 * Orders one level of a folder: directories first, then newest first, and by name where the times
 * are equal. A host that sorts by name gives every entry {@link UNTIMED}.
 */
function compareFolderEntries(a: TimedEntry, b: TimedEntry): number {
  if (a.entry.kind !== b.entry.kind) return a.entry.kind === "directory" ? -1 : 1;
  if (a.time !== b.time) return b.time - a.time;
  return nameCollator.compare(a.entry.name, b.entry.name);
}

/**
 * Orders the entries a folder listed. `times` is one time per entry, or undefined for the name
 * order; a timed entry carries the time it was sorted by, so a row can show it.
 */
export function sortFolderEntries(
  entries: readonly FolderEntry[],
  times?: readonly (number | undefined)[],
): FolderEntry[] {
  return entries
    .map((entry, index) => ({ entry, time: times?.[index] ?? UNTIMED }))
    .toSorted(compareFolderEntries)
    .map(({ entry, time }) => {
      if (time !== UNTIMED) entry.time = time;
      return entry;
    });
}
