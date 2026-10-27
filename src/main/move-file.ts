import { copyFile, rename, rm } from "node:fs/promises";

/** Whether a rename failed because the two paths sit on different file systems. */
function isCrossDevice(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EXDEV";
}

/**
 * Moves a file, copying it when the destination is on another volume: a rename cannot cross one,
 * and the native save dialog lets the user pick a folder anywhere.
 */
export async function moveFile(from: string, to: string): Promise<void> {
  try {
    await rename(from, to);
  } catch (error) {
    if (!isCrossDevice(error)) throw error;
    await copyFile(from, to);
    await rm(from);
  }
}
