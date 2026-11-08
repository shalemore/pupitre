import { isNotJunk } from "junk";

/** Whether a name is hidden on every platform: a dot name or a file another tool leaves behind. */
export function isHiddenName(name: string): boolean {
  return name.startsWith(".") || !isNotJunk(name);
}
