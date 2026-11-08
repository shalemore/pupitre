/** The last segment of a path, whatever separator it uses. */
export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** A file name with every run of characters a file system may dislike replaced by a hyphen. */
export function fileStem(name: string): string {
  return name.replace(/[^\p{L}\p{N}._-]+/gu, "-");
}
