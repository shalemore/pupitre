import { desktop } from "@/lib/desktop";

/** The type of a picked picture, kept on the File so a document without a file can show it before the save. */
const IMAGE_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
};

/** The image the user picked from disk, as the File a pasted picture arrives as; null when they dropped out of the dialog. */
export async function pickImage(): Promise<File | null> {
  const picked = await desktop.invoke("image:pick");
  if (picked === null) return null;
  const extension = picked.name.slice(picked.name.lastIndexOf(".") + 1).toLowerCase();
  const type = IMAGE_TYPES[extension] ?? "";
  // slice() gives the bytes an ArrayBuffer of their own, which is what a Blob takes
  return new File([picked.data.slice()], picked.name, { type });
}

/** Writes a pasted or dropped picture next to `documentPath` and returns the address to link it. */
export async function saveImageNextTo(documentPath: string, file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return desktop.invoke("document:save-image", documentPath, file.name, bytes);
}
