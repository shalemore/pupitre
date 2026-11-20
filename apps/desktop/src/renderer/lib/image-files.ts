import { desktop } from "@pupitre/desktop-api/client";
import { imageMimeType } from "@pupitre/utils";

/** The image the user picked from disk, as the File a pasted picture arrives as; null when they dropped out of the dialog. */
export async function pickImage(): Promise<File | null> {
  const picked = await desktop.invoke("image:pick");
  if (picked === null) return null;
  const extension = picked.name.slice(picked.name.lastIndexOf(".") + 1).toLowerCase();
  const type = imageMimeType(extension) ?? "";
  // slice() gives the bytes an ArrayBuffer of their own, which is what a Blob takes
  return new File([picked.data.slice()], picked.name, { type });
}

/** Writes a pasted or dropped picture next to `documentPath` and returns the address to link it. */
export async function saveImageNextTo(documentPath: string, file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return desktop.invoke("document:save-image", documentPath, file.name, bytes);
}
