import { hash } from "node:crypto";
import { rmSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { app } from "electron";
import log from "electron-log/main";
import { z } from "zod";
import type { HistoryEntry } from "@shared/desktop-api";
import { readJsonFile, writeJsonFile } from "../json-file";

const MAX_VERSIONS_PER_DOCUMENT = 20;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
/**
 * The largest document a save keeps a snapshot of. A file larger than this would crowd out the
 * history of ordinary notes and spend seconds copying itself into the profile on every save.
 */
export const MAX_SNAPSHOT_BYTES = 16 * 1024 * 1024;

/**
 * The id names the snapshot file, so it can hold neither a separator nor a dot: an index edited by
 * hand must not be able to read a file outside the folder of the document it names.
 */
const entrySchema = z.strictObject({
  id: z.string().regex(/^[0-9A-Za-z-]+$/),
  savedAt: z.number(),
  bytes: z.number(),
});

const documentSchema = z.strictObject({
  path: z.string(),
  /** Newest first, which is the order they are listed in and the order the limit drops them from. */
  entries: z.array(entrySchema),
});

const indexSchema = z.record(z.string(), documentSchema);

type DocumentHistory = z.infer<typeof documentSchema>;

/** The versions of every document, under the hash of its path. */
type HistoryIndex = Record<string, DocumentHistory>;

let index: HistoryIndex | undefined;

function historyFolder(): string {
  return join(app.getPath("userData"), "history");
}

function indexPath(): string {
  return join(historyFolder(), "index.json");
}

/** The folder of one document's versions: a hash of its path, which is a name whatever the path holds. */
function versionsFolder(key: string): string {
  return join(historyFolder(), key);
}

function snapshotFile(key: string, id: string): string {
  return join(versionsFolder(key), `${id}.md`);
}

/**
 * One spelling per file: the same document can be reached by a path with either separator, and all
 * of its saves have to keep their versions in the same folder. The resolve matches the one the
 * document itself gets when it is opened.
 */
function keyOf(path: string): string {
  return hash("sha1", resolve(path), "hex");
}

/** What is known of the versions; a file that cannot be read as an index leaves nothing to list. */
function historyIndex(): HistoryIndex {
  if (index === undefined) {
    const parsed = indexSchema.safeParse(readJsonFile(indexPath()));
    index = parsed.success ? parsed.data : {};
  }
  return index;
}

/**
 * The time a version was kept, in a form a file name can hold and a person can read in a folder
 * listing; the minutes and seconds keep the versions of a document in the order they were kept.
 */
function idOf(savedAt: number): string {
  const at = new Date(savedAt);
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  const time = `${pad(at.getHours())}-${pad(at.getMinutes())}-${pad(at.getSeconds())}`;
  return `${date}T${time}-${pad(at.getMilliseconds(), 3)}`;
}

/** Two saves can land in the same millisecond, and the second must not overwrite the first. */
function uniqueId(entries: readonly HistoryEntry[], savedAt: number): string {
  const stamp = idOf(savedAt);
  let id = stamp;
  for (let suffix = 1; entries.some((entry) => entry.id === id); suffix++) {
    id = `${stamp}-${suffix}`;
  }
  return id;
}

function removeSnapshot(key: string, id: string): void {
  rmSync(snapshotFile(key, id), { force: true });
}

/** Drops a version and, once the last one of its document is gone, the folder that held them. */
function forgetVersion(target: HistoryIndex, key: string, entry: HistoryEntry): void {
  removeSnapshot(key, entry.id);
  const document = target[key];
  if (document === undefined) return;
  document.entries = document.entries.filter((kept) => kept.id !== entry.id);
  if (document.entries.length > 0) return;
  delete target[key];
  rmSync(versionsFolder(key), { recursive: true, force: true });
}

function totalBytes(target: HistoryIndex): number {
  let total = 0;
  for (const document of Object.values(target)) {
    for (const entry of document.entries) total += entry.bytes;
  }
  return total;
}

/** The oldest version of all documents, which is the next to go once the whole folder is too big. */
function oldestVersion(target: HistoryIndex): { key: string; entry: HistoryEntry } | undefined {
  let oldest: { key: string; entry: HistoryEntry } | undefined;
  for (const [key, document] of Object.entries(target)) {
    for (const entry of document.entries) {
      if (oldest === undefined || entry.savedAt < oldest.entry.savedAt) oldest = { key, entry };
    }
  }
  return oldest;
}

/** Keeps a document's versions to their count, then the whole history folder to its size. */
function enforceLimits(target: HistoryIndex): void {
  for (const [key, document] of Object.entries(target)) {
    for (const entry of document.entries.splice(MAX_VERSIONS_PER_DOCUMENT)) {
      removeSnapshot(key, entry.id);
    }
  }
  let bytes = totalBytes(target);
  while (bytes > MAX_TOTAL_BYTES) {
    const oldest = oldestVersion(target);
    if (oldest === undefined) return;
    bytes -= oldest.entry.bytes;
    forgetVersion(target, oldest.key, oldest.entry);
  }
}

/**
 * Keeps the text a save is about to write over. A failure to keep it is logged and dropped: a
 * version the user may never ask for is not worth failing the save they did ask for.
 */
export async function recordVersion(path: string, markdown: string): Promise<void> {
  const bytes = Buffer.byteLength(markdown, "utf8");
  if (bytes > MAX_SNAPSHOT_BYTES) return;
  const key = keyOf(path);
  try {
    const savedAt = Date.now();
    const versions = historyIndex();
    const document = versions[key] ?? { path: resolve(path), entries: [] };
    const id = uniqueId(document.entries, savedAt);
    // Snapshots are plain UTF-8 text whatever the encoding the file itself was written in, so a
    // version reads back in any editor and needs no encoding of its own to be restored
    await mkdir(versionsFolder(key), { recursive: true });
    await writeFile(snapshotFile(key, id), markdown, "utf8");
    document.entries.unshift({ id, savedAt, bytes });
    versions[key] = document;
    enforceLimits(versions);
    // The index is written last, so a version that never made it to the disk is never listed
    writeJsonFile(indexPath(), versions);
  } catch (error) {
    log.error(`Could not keep a version of ${path}:`, error);
  }
}

/** The versions kept of a document, newest first. */
export function listVersions(path: string): HistoryEntry[] {
  const document = historyIndex()[keyOf(path)];
  return document === undefined ? [] : [...document.entries];
}

/** The text of one version of a document; null when it has none by that id, whatever the id names. */
export async function readVersion(path: string, id: string): Promise<string | null> {
  const key = keyOf(path);
  const document = historyIndex()[key];
  if (document === undefined || !document.entries.some((entry) => entry.id === id)) return null;
  try {
    return await readFile(snapshotFile(key, id), "utf8");
  } catch {
    return null;
  }
}
