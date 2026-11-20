import { isAbsolute, relative, sep } from "node:path";

/** Whether `path` is inside `root`, and not root itself. */
export function isInside(root: string, path: string): boolean {
  const rel = relative(root, path);
  // A child may be named "..foo"; only ".." and "../" actually leave the root
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
