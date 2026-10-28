import { createSignal } from "solid-js";
import { z } from "zod";
import type { ImportedTheme } from "@shared/desktop-api";
import { DEFAULT_LOCALE, LOCALE_CODES, type SupportedLocale } from "@shared/i18n";
import { DEFAULT_SETTINGS } from "@shared/settings";
import { desktop } from "@/lib/desktop";

type ColorScheme = "light" | "dark";

/**
 * A theme's text: one string for every language, or text keyed by the app's locale codes. A
 * language the theme leaves out falls back to the app's default locale, then to the first text
 * it gives.
 */
export type LocalizedText = string | Partial<Record<SupportedLocale, string>>;

/** Where a theme comes from: the app bundle, the global themes folder, or the open project's. */
type ThemeSource = "builtin" | "global" | "project";

export interface ThemeInfo {
  /** Value stored in settings: the folder name for a built-in theme, `source:folder` otherwise. */
  id: string;
  /** Folder name under src/renderer/themes, or in an imported theme root. */
  name: string;
  /** Where the theme was found. */
  source: ThemeSource;
  /** The name shown in settings, in the language of the window. */
  names: LocalizedText;
  /** What the theme is, for later use; the settings do not show it yet. */
  descriptions: LocalizedText | undefined;
  /** Color schemes the theme provides, read from its `color-scheme` declaration. */
  schemes: readonly ColorScheme[];
}

const localizedTextSchema = z.union([
  z.string().min(1),
  z.partialRecord(z.enum(LOCALE_CODES), z.string().min(1)),
]);

/** The shape of a theme's optional `theme.json`, next to its `index.css`. */
export const themeMetaSchema = z.object({
  name: localizedTextSchema,
  description: localizedTextSchema.optional(),
});

/** The text in the window's language: exact, then the default locale, then the first it gives. */
export function localizedText(
  text: LocalizedText | undefined,
  locale: SupportedLocale,
): string | undefined {
  if (text === undefined) return undefined;
  if (typeof text === "string") return text;
  return text[locale] ?? text[DEFAULT_LOCALE] ?? Object.values(text).at(0);
}

/** The theme's name for the window's language, or its folder name when it gives none. */
export function themeDisplayName(theme: ThemeInfo, locale: SupportedLocale): string {
  return localizedText(theme.names, locale) ?? theme.name;
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

/**
 * A theme's optional metadata, next to its stylesheet. It carries the name shown in settings and
 * the description kept for later use; a theme without one is named after its folder. The themes
 * under src/renderer/themes ship with the app, and the tests require each of them to name and
 * describe every locale; a theme installed from outside may leave languages out and falls back.
 */
const themeMeta = import.meta.glob<unknown>("../themes/*/theme.json", {
  import: "default",
  eager: true,
});

/** The built-in folder the default settings point at. */
export const DEFAULT_THEME = DEFAULT_SETTINGS.theme;

function themeName(path: string): string {
  return path.split("/").at(-2) ?? "";
}

interface ThemeMetadata {
  names: LocalizedText;
  descriptions: LocalizedText | undefined;
}

function themeMetadata(name: string): ThemeMetadata {
  const meta = themeMeta[`../themes/${name}/theme.json`];
  const parsed = meta === undefined ? undefined : themeMetaSchema.safeParse(meta);
  if (parsed === undefined || !parsed.success) {
    return { names: name, descriptions: undefined };
  }
  return { names: parsed.data.name, descriptions: parsed.data.description };
}

/**
 * Reads the schemes a theme declares with the standard `color-scheme` property on :root, e.g.
 * `color-scheme: light dark`. Comments are removed first, because theme guides quote
 * `@media (prefers-color-scheme: dark)` in prose and a comment must not count as a declaration.
 * Values are kept in the order declared; a theme without one is treated as light only.
 */
export function readColorScheme(css: string): ColorScheme[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, body = ""] of source.matchAll(/:root[^{}]*\{([^{}]*)\}/g)) {
    const declared = /(?:^|[^-a-z])color-scheme\s*:\s*([^;]+)/i.exec(body)?.[1];
    if (declared === undefined) continue;
    const schemes = declared
      .trim()
      .split(/\s+/)
      .filter((scheme): scheme is ColorScheme => scheme === "light" || scheme === "dark");
    if (schemes.length > 0) return schemes;
  }
  return ["light"];
}

function supportedSchemes(css: string): ColorScheme[] {
  return readColorScheme(css);
}

const builtInCss: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(themeStyles).map(([path, css]) => [themeName(path), css]),
);

const builtInThemes: readonly ThemeInfo[] = Object.entries(themeStyles).map(
  ([path, css]): ThemeInfo => {
    const name = themeName(path);
    const meta = themeMetadata(name);
    return {
      id: name,
      name,
      source: "builtin",
      names: meta.names,
      descriptions: meta.descriptions,
      schemes: supportedSchemes(css),
    };
  },
);

const [imported, setImported] = createSignal<readonly ImportedTheme[]>(desktop.initialState.themes);

/** The folders the main process found in the global and project theme folders. */
export const importedThemes = imported;

void desktop.invoke("themes:list").then(setImported);
desktop.on("themes:changed", (list) => setImported(list));

function importedThemeInfo(theme: ImportedTheme): ThemeInfo {
  const parsed = themeMetaSchema.safeParse(theme.meta);
  return {
    id: `${theme.source}:${theme.folder}`,
    name: theme.folder,
    source: theme.source,
    names: parsed.success ? parsed.data.name : theme.folder,
    descriptions: parsed.success ? parsed.data.description : undefined,
    schemes: supportedSchemes(theme.css),
  };
}

/** The built-in themes and the folders in the global and project theme folders. */
export function themes(): readonly ThemeInfo[] {
  const all = [...builtInThemes, ...imported().map(importedThemeInfo)];
  return [
    ...all.filter((theme) => theme.id === DEFAULT_THEME),
    ...all
      .filter((theme) => theme.id !== DEFAULT_THEME)
      .toSorted((a, b) => a.id.localeCompare(b.id)),
  ];
}

let styleElement: HTMLStyleElement | undefined;
const [applied, setApplied] = createSignal(undefined, { equals: false });

/**
 * Notifies every time the theme is applied, including a switch of the color scheme. Read it to
 * redo work that copies theme colors outside CSS, such as diagrams.
 */
export const themeApplied = applied;

function cssFor(id: string): string | undefined {
  const found = imported().find((theme) => `${theme.source}:${theme.folder}` === id);
  return found?.css ?? builtInCss[id];
}

export function applyTheme(id: string): void {
  const css = cssFor(id) ?? cssFor(DEFAULT_THEME) ?? "";
  styleElement ??= document.head.appendChild(document.createElement("style"));
  styleElement.textContent = `@layer document-theme {\n${css}\n}`;
  setApplied();
}

/**
 * The stylesheet of the theme in use, in the cascade layer it is applied in. A page built outside
 * this window, such as an exported HTML file, has its own stylesheets; this gives it the theme
 * without reading back through the document's CSSOM.
 */
export function activeThemeCss(): string {
  return styleElement?.textContent ?? "";
}

/** Converts any CSS color (themes mostly use oklch) to #rrggbb, for APIs that only take hex. */
export function toHex(color: string): string {
  const context = new OffscreenCanvas(1, 1).getContext("2d");
  if (!context) return "#000000";
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
  return `#${Uint8Array.of(r, g, b).toHex()}`;
}

/** Whether a #rrggbb color reads as dark: a page or a diagram takes its scheme from the color it sits on. */
export function isDarkColor(hex: string): boolean {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) =>
    Number.parseInt(hex.slice(start, start + 2), 16),
  );
  // Rec. 709 luma: the eye sees green as the brightest of the three, so plain brightness would not do
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

/** The active theme's canvas and secondary text colors, for the window background and caption buttons. */
export function readWindowColors(): { background: string; symbol: string } {
  const style = getComputedStyle(document.documentElement);
  return {
    background: toHex(style.getPropertyValue("--ui-surface-1")),
    symbol: toHex(style.getPropertyValue("--ui-text-secondary")),
  };
}
