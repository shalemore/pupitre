import { readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import log from "electron-log/main";
import { ASSET_URL, inlineAssets } from "../css-assets";
import { isInside } from "../is-inside";

const MAX_STYLE_BYTES = 2 * 1024 * 1024;

/**
 * What a plugin stylesheet may not contain. `@import` would load CSS the sanitizer never saw,
 * `!important` reverses the cascade layers and beats the user's preferences, and `@property` and
 * `expression()` reach outside the stylesheet into the page.
 */
const FORBIDDEN = [
  [/@import\b/i, "@import"],
  [/@property\b/i, "@property"],
  [/!important/i, "!important"],
  [/expression\s*\(/i, "expression()"],
] as const;

/** A `url()` may only name a data URL the host inlined, a fragment, or a custom property. */
function unsafeUrl(css: string): string | undefined {
  for (const match of css.matchAll(ASSET_URL)) {
    const url = match[2]?.trim();
    if (url === undefined || /^(?:data:|#|var\()/i.test(url)) continue;
    return `url(${url})`;
  }
  return undefined;
}

function styleProblem(css: string): string | undefined {
  for (const [pattern, name] of FORBIDDEN) {
    if (pattern.test(css)) return name;
  }
  return unsafeUrl(css);
}

/**
 * The plugin's stylesheet with its relative assets inlined, or none when it leaves its folder,
 * is too large or uses something the app does not let a plugin CSS do.
 */
export function readPluginStyle(folder: string, styles: string): string | undefined {
  try {
    const root = realpathSync(folder);
    const path = resolve(root, styles);
    if (!isInside(root, path)) return undefined;
    const real = realpathSync(path);
    if (!isInside(root, real)) return undefined;
    const stat = statSync(real);
    if (!stat.isFile() || stat.size > MAX_STYLE_BYTES) return undefined;
    const css = inlineAssets(readFileSync(real, "utf8"), dirname(real));
    const problem = styleProblem(css);
    if (problem !== undefined) {
      log.warn(`Skipped the stylesheet of ${folder}: it uses ${problem}`);
      return undefined;
    }
    return css;
  } catch {
    return undefined;
  }
}
