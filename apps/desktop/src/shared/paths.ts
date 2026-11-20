/**
 * A path written with forward slashes, the form Markdown links and the pins file use. Only the
 * renderer and the web host compare paths this way; the main process keeps `node:path`, since a
 * backslash is a legal file name character where the platform's separator is a slash.
 */
export function toSlashes(path: string): string {
  return path.replaceAll("\\", "/");
}

/** A folder root in the form the comparisons below expect: forward slashes, no trailing one. */
function folderRoot(folder: string): string {
  return toSlashes(folder).replace(/\/+$/, "");
}

export function isInsideFolder(folder: string, path: string): boolean {
  return toSlashes(path).startsWith(`${folderRoot(folder)}/`);
}

/** Where `path` sits under `folder`, or undefined when it is not inside it. */
export function relativeToFolder(folder: string, path: string): string | undefined {
  const root = folderRoot(folder);
  const full = toSlashes(path);
  return full.startsWith(`${root}/`) ? full.slice(root.length + 1) : undefined;
}
