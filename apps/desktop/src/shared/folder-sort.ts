import type { FolderEntry } from "./desktop-api";
import { nameCollator } from "./name-collator";

/** What an entry that the host cannot date sorts as: the end of the list. */
export const UNTIMED = Number.MIN_SAFE_INTEGER;

/** One entry with the time the sort reads. */
export interface TimedEntry {
  entry: FolderEntry;
  time: number;
}

/**
 * Orders one level of a folder: directories first, then newest first, and by name where the times
 * are equal. A host that sorts by name gives every entry {@link UNTIMED}.
 */
export function compareFolderEntries(a: TimedEntry, b: TimedEntry): number {
  if (a.entry.kind !== b.entry.kind) return a.entry.kind === "directory" ? -1 : 1;
  if (a.time !== b.time) return b.time - a.time;
  return nameCollator.compare(a.entry.name, b.entry.name);
}
