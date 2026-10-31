import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Attributes } from "winattr";
import type { FolderEntry } from "@shared/desktop-api";
import { isHiddenName } from "@shared/hidden";
import { createIOLimit } from "./io-limit";

type ReadAttributes = (path: string) => Promise<Attributes>;

/** Undefined until the first Windows read, null when the attribute reader cannot load. */
let reader: Promise<ReadAttributes | null> | undefined;

function attributesReader(): Promise<ReadAttributes | null> {
  return (reader ??= import("winattr").then(
    (winattr) => async (path) => {
      // winattr's types nest the promise one level too deep; awaiting the result flattens it
      const attributes = await winattr.getAttributes(path);
      return attributes;
    },
    () => null,
  ));
}

/** Windows keeps hidden and system out of the directory entry, so each row asks for them. */
async function isSystemHidden(path: string): Promise<boolean> {
  if (process.platform !== "win32") return false;
  const read = await attributesReader();
  if (read === null) return false;
  try {
    const attributes = await read(path);
    return attributes.hidden || attributes.system;
  } catch {
    // A file that vanished or cannot be read still gets a row; the folder read decides
    return false;
  }
}

/** The entries of one level of a folder, in no order. */
export async function readFolder(path: string): Promise<FolderEntry[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return entries.map((entry) => ({
    name: entry.name,
    path: join(path, entry.name),
    kind: entry.isDirectory() ? "directory" : "file",
  }));
}

/**
 * Marks the entries the sidebar leaves out unless hidden files are shown. The name rule costs
 * nothing and runs everywhere; the Windows attribute probe runs only on Windows.
 */
export async function markHidden(entries: readonly FolderEntry[]): Promise<FolderEntry[]> {
  if (process.platform !== "win32") {
    return entries.map((entry) => (isHiddenName(entry.name) ? { ...entry, hidden: true } : entry));
  }
  const limit = createIOLimit();
  return Promise.all(
    entries.map((entry) => {
      if (isHiddenName(entry.name)) return Promise.resolve({ ...entry, hidden: true });
      return limit(async () => {
        const hidden = await isSystemHidden(entry.path);
        return hidden ? { ...entry, hidden: true } : entry;
      });
    }),
  );
}
