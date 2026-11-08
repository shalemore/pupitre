import { readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { isInside } from "./is-inside";

const MAX_ASSET_BYTES = 8 * 1024 * 1024;

/** The asset types a stylesheet may use through a relative `url()`. */
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

/** Every `url()` of a stylesheet, with the quote it used; the value never contains a quote. */
export const ASSET_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

/** Replaces relative `url()`s with data URLs, so the stylesheet travels without its folder. */
export function inlineAssets(css: string, dir: string): string {
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

/** Whether a `url()` points at a file beside the stylesheet rather than at a scheme. */
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
    return `data:${type};base64,${readFileSync(asset, "base64")}`;
  } catch {
    return undefined;
  }
}
