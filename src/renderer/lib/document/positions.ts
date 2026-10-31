import { debounce } from "@solid-primitives/scheduled";
import { z } from "zod";

export interface DocumentPosition {
  /** Offset of the caret in the text. */
  caret: number;
  /** Offset of the line that was at the top of the editor. */
  topLine: number;
  /**
   * How far the top of that line sat above the top edge of the editor, in pixels; 0 or negative,
   * since the line is cut by that much.
   */
  topOffset: number;
}

interface StoredPosition extends DocumentPosition {
  path: string;
}

const STORAGE_KEY = "pupitre:document-positions";
const WRITE_DELAY = 400;
/** Only the documents read last keep a place; past this, the oldest entry makes room for the new one. */
const MAX_ENTRIES = 200;

const storedPositionSchema = z.object({
  path: z.string(),
  caret: z.number().nonnegative(),
  topLine: z.number().nonnegative(),
  topOffset: z.number(),
});
const storedPositionsSchema = z.array(storedPositionSchema);

function readPositions(): StoredPosition[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    const parsed = storedPositionsSchema.safeParse(stored);
    return parsed.success ? parsed.data : [];
  } catch {
    // Storage that cannot be read or holds no JSON only costs the places, never a document
    return [];
  }
}

/** Most recently used first, which is also the order the oldest entry is dropped in. */
let positions = readPositions();
let unwritten = false;

function writePositions(): void {
  unwritten = false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Full or unavailable storage only costs the places; the documents themselves are files
  }
}

// Scrolling reports a new place many times a second, far more often than storage has to be written
const scheduleWrite = debounce(writePositions, WRITE_DELAY);

/** Where the reader left the document at `path`; undefined for a document with no file, or one not opened before. */
export function documentPosition(path: string | undefined): DocumentPosition | undefined {
  if (path === undefined) return undefined;
  const stored = positions.find((position) => position.path === path);
  return stored === undefined
    ? undefined
    : { caret: stored.caret, topLine: stored.topLine, topOffset: stored.topOffset };
}

export function rememberDocumentPosition(path: string, position: DocumentPosition): void {
  positions = [{ path, ...position }, ...positions.filter((stored) => stored.path !== path)].slice(
    0,
    MAX_ENTRIES,
  );
  unwritten = true;
  scheduleWrite();
}

/** Writes the places now, for a window that closes before the next write was due. */
export function flushDocumentPositions(): void {
  if (!unwritten) return;
  scheduleWrite.clear();
  writePositions();
}
