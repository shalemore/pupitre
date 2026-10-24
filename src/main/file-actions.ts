import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { shell } from "electron";
import type { FolderEntry } from "@shared/desktop-api";

/**
 * A name the file system accepts: trimmed, not empty, not "this folder", and free of the characters
 * Windows reserves and of path separators, which would point outside the folder.
 */
function checkedName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "" || trimmed === "." || trimmed === ".." || /[\\/:*?"<>|]/.test(trimmed)) {
    throw new Error(`"${name}" cannot name a file`);
  }
  return trimmed;
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

/** Refuses to replace something that is already there; renaming onto a file the user cannot see would lose it. */
async function assertFree(path: string): Promise<void> {
  if (await exists(path)) throw new Error(`${path} already exists`);
}

export async function renameEntry(path: string, name: string): Promise<string> {
  const target = join(dirname(path), checkedName(name));
  if (target === path) return path;
  await assertFree(target);
  await rename(path, target);
  return target;
}

/** "Untitled.md" and then "Untitled 2.md", so creating twice in a row does not have to ask for a name. */
function numbered(name: string, attempt: number): string {
  if (attempt === 0) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  return `${base} ${attempt + 1}${extension}`;
}

/** The first name of this series that is still free. */
async function freeTarget(parent: string, base: string, attempt: number): Promise<string> {
  const target = join(parent, numbered(base, attempt));
  return (await exists(target)) ? freeTarget(parent, base, attempt + 1) : target;
}

export async function createEntry(
  parent: string,
  name: string,
  kind: FolderEntry["kind"],
): Promise<string> {
  const target = await freeTarget(parent, checkedName(name), 0);
  if (kind === "directory") await mkdir(target);
  // "wx" so that nothing created in between is overwritten
  else await writeFile(target, "", { flag: "wx" });
  return target;
}

export function trashEntry(path: string): Promise<void> {
  return shell.trashItem(path);
}
