import { DEFAULT_SETTINGS } from "@shared/settings";
import { createSignal } from "solid-js";

export type ColorScheme = "light" | "dark";

export interface ThemeInfo {
  /** Folder name under src/renderer/themes, also shown in settings. */
  name: string;
  /** Color schemes the theme provides, read from its `color-scheme` declaration. */
  schemes: readonly ColorScheme[];
}

/**
 * Every theme is src/renderer/themes/<name>/index.css. Vite inlines the processed CSS (relative
 * url()s to fonts or images next to the theme keep working), and the active one is injected into
 * the `document-theme` cascade layer: above the app defaults, below the user's preferences.
 */
const themeStyles = import.meta.glob<string>("../themes/*/index.css", {
  query: "?inline",
  import: "default",
  eager: true,
});

const DEFAULT_THEME = DEFAULT_SETTINGS.theme;

function themeName(path: string): string {
  return path.split("/").at(-2) ?? "";
}

/**
 * A theme states which schemes it supports with the standard `color-scheme` property on :root,
 * e.g. `color-scheme: light dark`. Without it the theme is treated as light only.
 */
function supportedSchemes(css: string): ColorScheme[] {
  const declared = /color-scheme\s*:\s*([^;}]+)/.exec(css)?.[1] ?? "";
  const schemes = declared
    .trim()
    .split(/\s+/)
    .filter((scheme): scheme is ColorScheme => scheme === "light" || scheme === "dark");
  return schemes.length > 0 ? schemes : ["light"];
}

const allThemes = Object.entries(themeStyles).map(([path, css]) => ({
  name: themeName(path),
  schemes: supportedSchemes(css),
}));

/** The default theme first, the others by name. */
export const THEMES: readonly ThemeInfo[] = [
  ...allThemes.filter((theme) => theme.name === DEFAULT_THEME),
  ...allThemes
    .filter((theme) => theme.name !== DEFAULT_THEME)
    .toSorted((a, b) => a.name.localeCompare(b.name)),
];

let styleElement: HTMLStyleElement | undefined;
const [applied, setApplied] = createSignal(undefined, { equals: false });

/**
 * Notifies every time the theme is applied, including a switch of the color scheme. Read it to
 * redo work that copies theme colors outside CSS, such as diagrams.
 */
export const themeApplied = applied;

export function applyTheme(name: string): void {
  const css =
    themeStyles[`../themes/${name}/index.css`] ??
    themeStyles[`../themes/${DEFAULT_THEME}/index.css`];
  styleElement ??= document.head.appendChild(document.createElement("style"));
  styleElement.textContent = `@layer document-theme {\n${css ?? ""}\n}`;
  setApplied();
}

/** Converts any CSS color (themes mostly use oklch) to #rrggbb, for APIs that only take hex. */
export function toHex(color: string): string {
  const context = new OffscreenCanvas(1, 1).getContext("2d");
  if (!context) return "#000000";
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

/** The active theme's canvas and secondary text colors, for the window background and caption buttons. */
export function readWindowColors(): { background: string; symbol: string } {
  const style = getComputedStyle(document.documentElement);
  return {
    background: toHex(style.getPropertyValue("--ui-surface-1")),
    symbol: toHex(style.getPropertyValue("--ui-text-secondary")),
  };
}
