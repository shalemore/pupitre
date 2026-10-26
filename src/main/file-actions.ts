import { copyFile, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { net, shell } from "electron";
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

/** A picture is linked rather than embedded, so one larger than this is already unusual. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** Whether a rename failed because the two paths sit on different file systems. */
function isCrossDevice(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EXDEV";
}

/**
 * Moves a file, copying it when the destination is on another volume: a rename cannot cross one,
 * and the native save dialog lets the user pick a folder anywhere.
 */
async function moveFile(from: string, to: string): Promise<void> {
  try {
    await rename(from, to);
  } catch (error) {
    if (!isCrossDevice(error)) throw error;
    await copyFile(from, to);
    await rm(from);
  }
}

/** Moves a picture to the path the user picked for it and gives back where it now sits. */
export async function moveImage(path: string, target: string): Promise<string> {
  if (resolve(target) === resolve(path)) return path;
  await moveFile(path, target);
  return target;
}

/** Moves a picture into `folder`, keeping its name, or numbering it where that name is taken. */
export async function moveImageInto(path: string, folder: string): Promise<string> {
  // A picture already there keeps both its place and its name, and the link stands as it is
  if (resolve(dirname(path)) === resolve(folder)) return path;
  await mkdir(folder, { recursive: true });
  const target = await freeTarget(folder, basename(path), 0);
  await moveFile(path, target);
  return target;
}

/** Copies a picture into `folder`, numbering the copy where its name is taken there. */
export async function copyImageInto(path: string, folder: string): Promise<string> {
  await mkdir(folder, { recursive: true });
  const target = await freeTarget(folder, basename(path), 0);
  await copyFile(path, target);
  return target;
}

/** The extension of a picture a server names by its type, for an address that has none of its own. */
const IMAGE_TYPES: Readonly<Record<string, string>> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/bmp": ".bmp",
  "image/avif": ".avif",
};

/** `text` with its percent escapes read back; as it is where they are not valid escape text. */
function decoded(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** The name a downloaded picture is written under: the last part of its address, or a name of its own type. */
function downloadName(url: URL, contentType: string | undefined): string {
  const last = decoded(url.pathname.split("/").at(-1) ?? "");
  const name = last.replace(/[^\p{L}\p{N}._-]+/gu, "-");
  if (/\.[a-z0-9]{1,5}$/i.test(name)) return name;
  const type = (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const stem = name === "" || name === "." ? "image" : name;
  return `${stem}${IMAGE_TYPES[type] ?? ".png"}`;
}

/** Writes the picture behind a web address into `folder`, where the document can link it. */
export async function downloadImage(url: string, folder: string): Promise<string> {
  const address = new URL(url);
  if (address.protocol !== "http:" && address.protocol !== "https:") {
    throw new Error(`${url} is not a web address`);
  }
  const response = await net.fetch(address.href);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.byteLength > MAX_IMAGE_BYTES) throw new Error(`${url} is too large to download`);
  await mkdir(folder, { recursive: true });
  const name = downloadName(address, response.headers.get("content-type") ?? undefined);
  const target = await freeTarget(folder, name, 0);
  await writeFile(target, data, { flag: "wx" });
  return target;
}
