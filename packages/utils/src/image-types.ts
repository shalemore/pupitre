/** The picture formats the app reads and writes, by the extension a file has. */
export const IMAGE_MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
} as const;

type ImageExtension = keyof typeof IMAGE_MIME_TYPES;

function isImageExtension(value: string): value is ImageExtension {
  return Object.hasOwn(IMAGE_MIME_TYPES, value);
}

/** The type a picture extension names, with or without its dot; undefined for another file. */
export function imageMimeType(extension: string): string | undefined {
  const normalized = (extension.startsWith(".") ? extension : `.${extension}`).toLowerCase();
  return isImageExtension(normalized) ? IMAGE_MIME_TYPES[normalized] : undefined;
}

/** The extension a picture of this type is written under, such as `.jpg` for `image/jpeg`. */
export function imageExtensionFor(mimeType: string): string | undefined {
  const type = (mimeType.split(";")[0] ?? "").trim().toLowerCase();
  for (const extension of Object.keys(IMAGE_MIME_TYPES)) {
    if (isImageExtension(extension) && IMAGE_MIME_TYPES[extension] === type) return extension;
  }
  return undefined;
}
