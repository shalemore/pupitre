import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { ImportedTheme } from "@pupitre/desktop-api";
import { nameCollator } from "@shared/name-collator";
import { inlineAssets } from "../css-assets";
import { isInside } from "../is-inside";

const STYLE_FILE = "index.css";
const META_FILE = "theme.json";
const MAX_STYLE_BYTES = 2 * 1024 * 1024;
const MAX_META_BYTES = 64 * 1024;

/** Reads every theme folder under `root`; a folder without an `index.css` is not a theme. */
export function readThemesFromRoot(root: string, source: ImportedTheme["source"]): ImportedTheme[] {
  let folders: string[];
  try {
    folders = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .toSorted((a, b) => nameCollator.compare(a, b));
  } catch {
    return [];
  }
  const themes: ImportedTheme[] = [];
  for (const folder of folders) {
    const theme = readTheme(root, folder, source);
    if (theme !== undefined) themes.push(theme);
  }
  return themes;
}

function readTheme(
  root: string,
  folder: string,
  source: ImportedTheme["source"],
): ImportedTheme | undefined {
  const dir = resolve(root, folder);
  const style = fileWithin(dir, STYLE_FILE, MAX_STYLE_BYTES);
  if (style === undefined) return undefined;
  return {
    source,
    folder,
    css: inlineAssets(style, dir),
    meta: readMeta(dir),
  };
}

function readMeta(dir: string): unknown {
  const raw = fileWithin(dir, META_FILE, MAX_META_BYTES);
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Reads a file inside `dir`, never through a path that leaves it, and within `limit` bytes. */
function fileWithin(dir: string, name: string, limit: number): string | undefined {
  const path = resolve(dir, name);
  if (!isInside(dir, path)) return undefined;
  try {
    const stat = statSync(path);
    if (!stat.isFile() || stat.size > limit) return undefined;
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}
