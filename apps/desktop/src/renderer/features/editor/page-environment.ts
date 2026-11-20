import { CODE_COLOR_TOKENS, type PageEnvironment, type PageTokens } from "@pupitre/markdown";
import { CONTENT_WIDTHS, DEFAULT_SETTINGS } from "@pupitre/settings";
import { toHex } from "@pupitre/utils";
import { FALLBACK_FONTS } from "@/lib/fonts";
import { activeThemeCss } from "@/lib/theme";
import { readToken, type TokenName } from "@/lib/tokens";

/**
 * The colors, fonts and measures of an exported page, taken from the variables the theme and the
 * settings set in the window. A color the canvas cannot convert stays as the theme wrote it, so a
 * host that never draws still gets a page.
 */
function readTokens(): PageTokens {
  const root = getComputedStyle(document.documentElement);
  const raw = (name: string) => root.getPropertyValue(name).trim();
  const token = (name: TokenName) => readToken(root, name);
  const hexOf = (color: string) => {
    if (color === "") return "#000000";
    try {
      return toHex(color);
    } catch {
      return color;
    }
  };
  const hex = (name: TokenName, fallback?: TokenName) =>
    hexOf(token(name) || (fallback === undefined ? "" : token(fallback)));
  return {
    page: hex("ui-surface-1"),
    card: hex("ui-surface-0"),
    text: hex("ui-text-primary"),
    soft: hex("ui-text-secondary"),
    faint: hex("ui-text-muted"),
    accent: hex("ui-brand"),
    danger: hex("ui-danger"),
    note: hex("alert-note", "ui-brand"),
    tip: hex("alert-tip", "ui-success"),
    important: hex("alert-important", "ui-brand"),
    warning: hex("alert-warning", "ui-danger"),
    caution: hex("alert-caution", "ui-danger"),
    bodyFont: token("pref-font-family") || token("font-document") || FALLBACK_FONTS.document,
    codeFont: token("pref-code-font") || token("font-mono") || FALLBACK_FONTS.code,
    fontSize: token("pref-font-size") || `${DEFAULT_SETTINGS.fontSize}px`,
    lineHeight: token("pref-line-height") || String(DEFAULT_SETTINGS.lineHeight),
    contentWidth: token("pref-content-width") || CONTENT_WIDTHS[DEFAULT_SETTINGS.contentWidth],
    syntax: CODE_COLOR_TOKENS.map((name) => ({
      name: `--syntax-${name}`,
      color: hexOf(raw(`--syntax-${name}`)),
    })),
  };
}

/** What the Markdown renderer needs of the window to style an exported page like the app. */
export function pageEnvironment(): PageEnvironment {
  return { tokens: readTokens(), themeCss: activeThemeCss() };
}
