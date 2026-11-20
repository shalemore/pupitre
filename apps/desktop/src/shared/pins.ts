import { toSlashes } from "./paths";

/**
 * A path under a folder root, written the way the pins file and the Markdown links write it:
 * forward slashes, no leading or trailing one, and no segment that leaves the folder.
 */
export function pinKeyOf(path: string): string | undefined {
  const key = toSlashes(path).replace(/^\/+|\/+$/g, "");
  if (key === "") return undefined;
  const segments = key.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return undefined;
  }
  return key;
}
