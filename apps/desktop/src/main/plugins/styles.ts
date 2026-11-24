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

/**
 * Scans CSS outside strings and comments to reject unbalanced braces, unclosed comments/strings,
 * and returns comment-free, escape-decoded text for forbidden-construct checks.
 */
function sanitizeScan(css: string): { ok: true; stripped: string } | { ok: false; reason: string } {
  let stripped = "";
  let depth = 0;
  let quote: '"' | "'" | undefined;
  let inComment = false;

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    const next = css[i + 1];

    if (inComment) {
      if (ch === "*" && next === "/") {
        inComment = false;
        i++;
      }
      continue;
    }

    if (quote !== undefined) {
      if (ch === "\\") {
        stripped += ch + (next ?? "");
        i++;
        continue;
      }
      stripped += ch;
      if (ch === quote) quote = undefined;
      continue;
    }

    if (ch === "/" && next === "*") {
      inComment = true;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      stripped += ch;
      continue;
    }

    if (ch === "\\") {
      const hex = /^\\([0-9a-fA-F]{1,6})[ \t\r\n\f]?/.exec(css.slice(i));
      if (hex?.[1] !== undefined) {
        const code = Number.parseInt(hex[1], 16);
        stripped += code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
        i += hex[0].length - 1;
      } else if (next !== undefined) {
        stripped += next;
        i++;
      }
      continue;
    }

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth < 0) return { ok: false, reason: "unbalanced braces" };
    }
    stripped += ch;
  }

  if (inComment) return { ok: false, reason: "unclosed comment" };
  if (quote !== undefined) return { ok: false, reason: "unclosed string" };
  if (depth !== 0) return { ok: false, reason: "unbalanced braces" };
  return { ok: true, stripped };
}

function styleProblem(css: string): string | undefined {
  const scan = sanitizeScan(css);
  if (!scan.ok) return scan.reason;
  for (const [pattern, name] of FORBIDDEN) {
    if (pattern.test(scan.stripped)) return name;
  }
  return unsafeUrl(scan.stripped);
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
