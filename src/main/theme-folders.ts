import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import type { ImportedTheme } from "@shared/desktop-api";
import { isInside } from "./is-inside";

const STYLE_FILE = "index.css";
const META_FILE = "theme.json";
const MAX_STYLE_BYTES = 2 * 1024 * 1024;
const MAX_META_BYTES = 64 * 1024;
const MAX_ASSET_BYTES = 8 * 1024 * 1024;

/** The asset types a theme may use through a relative `url()`. Other files are left alone. */
const ASSET_TYPES: Readonly<Record<string, string>> = {
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const ASSET_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

/** Reads every theme folder under `root`; a folder without an `index.css` is not a theme. */
export function readThemesFromRoot(root: string, source: ImportedTheme["source"]): ImportedTheme[] {
  let folders: string[];
  try {
    folders = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .toSorted((a, b) => a.localeCompare(b));
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

/** Replaces relative `url()`s with data URLs, so the stylesheet travels without its folder. */
function inlineAssets(css: string, dir: string): string {
  const cache = new Map<string, string | undefined>();
  return css.replace(ASSET_URL, (match, _quote: string, value: string) => {
    const url = value.trim();
    if (!isRelativeAsset(url)) return match;
    let data = cache.get(url);
    if (data === undefined && !cache.has(url)) {
      data = readAsset(dir, url);
      cache.set(url, data);
    }
    return data === undefined ? match : `url("${data}")`;
  });
}

function isRelativeAsset(url: string): boolean {
  if (url === "" || url.startsWith("#") || url.startsWith("/") || url.startsWith("var(")) {
    return false;
  }
  // data:, http:, file: and every other scheme stay as they are, for the page and its CSP to judge
  return !/^[a-z][a-z0-9+.-]*:/i.test(url);
}

function readAsset(dir: string, url: string): string | undefined {
  const path = url.split(/[?#]/, 1)[0] ?? "";
  if (path === "") return undefined;
  const asset = resolve(dir, path);
  if (!isInside(dir, asset)) return undefined;
  try {
    const stat = statSync(asset);
    if (!stat.isFile() || stat.size > MAX_ASSET_BYTES) return undefined;
    const type = ASSET_TYPES[extname(asset).toLowerCase()];
    if (type === undefined) return undefined;
    return `data:${type};base64,${readFileSync(asset).toString("base64")}`;
  } catch {
    return undefined;
  }
}
