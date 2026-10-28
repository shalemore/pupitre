import { isAbsolute, relative } from "node:path";

/** Whether `path` is inside `root`, and not root itself. */
export function isInside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}
