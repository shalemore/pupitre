import { stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { z } from "zod";
import type { PinnedEntry } from "@shared/desktop-api";
import { pinKeyOf } from "@shared/pins";
import { isInside } from "./is-inside";
import { readJsonFile, writeJsonFile } from "./json-file";

/** Where a folder keeps the entries pinned to the top of its sidebar. */
export const PINS_FILE = ".pupitre/pins.json";

const pinsFileSchema = z
  .object({
    version: z.literal(1),
    paths: z.array(z.string()),
  })
  .catch({ version: 1, paths: [] });

/** The keys of the paths a file holds: normalized, unique and inside `root`. */
function keysIn(root: string, paths: readonly string[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const raw of paths) {
    const key = pinKeyOf(raw);
    if (key === undefined || seen.has(key)) continue;
    if (!isInside(root, resolve(root, key))) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

/**
 * The entries pinned at the top of a folder, in the order they were pinned. A pin whose file or
 * folder is gone is left out until it comes back; the file keeps it so a rename or a temporary
 * absence does not erase the user's choice.
 */
export async function readPins(root: string): Promise<PinnedEntry[]> {
  const file = pinsFileSchema.parse(readJsonFile(join(root, PINS_FILE)));
  const keys = keysIn(root, file.paths);
  const pins = await Promise.all(
    keys.map(async (key): Promise<PinnedEntry | undefined> => {
      const path = resolve(root, key);
      try {
        const info = await stat(path);
        return {
          name: basename(path),
          path,
          kind: info.isDirectory() ? "directory" : "file",
          relative: key,
        };
      } catch {
        // The entry was moved or deleted elsewhere; its pin waits for it to return.
        return undefined;
      }
    }),
  );
  return pins.filter((pin): pin is PinnedEntry => pin !== undefined);
}

/** Replaces the pins of a folder; paths outside the folder are ignored. */
export function writePins(root: string, paths: readonly string[]): void {
  writeJsonFile(join(root, PINS_FILE), { version: 1, paths: keysIn(root, paths) });
}
