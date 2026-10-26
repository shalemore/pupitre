import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { DOCUMENT_FILE, type FolderFile } from "@shared/desktop-api";

/**
 * How many documents a walk collects before it stops. A folder that holds more than this is not
 * one a person picks a document out of by name, and searching all of it would take long enough to
 * be felt while the palette is already open.
 */
export const MAX_WORKSPACE_FILES = 20000;

/** Folders that hold dependencies rather than documents, wherever they turn up. */
const SKIPPED_FOLDERS = new Set(["node_modules"]);

// One collator for the whole walk: creating it per comparison is what makes localeCompare slow
const pathCollator = new Intl.Collator(undefined, { numeric: true });

/** A path written the way a palette shows it, whatever separator the platform joins paths with. */
function slashed(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

/** Where an entry sits under the folder a walk or a search started at. */
export function relativeTo(root: string, path: string): string {
  return slashed(relative(root, path));
}

/** Whether an entry is a folder to walk into: another tool's state and link cycles are not. */
export function isWorkspaceFolder(entry: Dirent): boolean {
  return entry.isDirectory() && !entry.name.startsWith(".") && !SKIPPED_FOLDERS.has(entry.name);
}

/** Whether an entry is a document: a text file, neither hidden nor a link to one somewhere else. */
export function isWorkspaceDocument(entry: Dirent): boolean {
  return entry.isFile() && !entry.name.startsWith(".") && DOCUMENT_FILE.test(entry.name);
}

/**
 * Walks a folder and everything under it, collecting the documents it holds. Hidden entries,
 * node_modules and symbolic links are left out: hidden files are the editor's own state and other
 * tools' work, and a link can reach outside the folder or back up the tree it came from.
 */
export async function listWorkspaceFiles(root: string): Promise<FolderFile[]> {
  const files: FolderFile[] = [];
  const walk = async (folder: string): Promise<void> => {
    if (files.length >= MAX_WORKSPACE_FILES) return;
    // A folder that cannot be read holds nothing to offer, and the walk goes on beside it
    const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
    await Promise.all(
      entries.map(async (entry) => {
        if (files.length >= MAX_WORKSPACE_FILES) return;
        const path = join(folder, entry.name);
        if (isWorkspaceFolder(entry)) return walk(path);
        if (isWorkspaceDocument(entry)) files.push({ path, relative: relativeTo(root, path) });
      }),
    );
  };
  await walk(root);
  // Branches walked side by side can step past the end between two checks, so the list is cut back
  return files
    .slice(0, MAX_WORKSPACE_FILES)
    .toSorted((a, b) => pathCollator.compare(a.relative, b.relative));
}
