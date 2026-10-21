/**
 * System Local Fonts Management
 * Queries local system fonts via Window.queryLocalFonts API with rich platform fallbacks
 * and runtime refresh capability without needing app restart.
 */

let cachedFontFamilies: string[] | null = null;

const POPULAR_SYSTEM_FONTS: readonly string[] = [
  // Presets
  "System Sans",
  "System Mono",
  "System Serif",

  // Modern Windows & Cross-platform Coding / Monospace Fonts
  "Cascadia Code",
  "Cascadia Mono",
  "Consolas",
  "Courier New",
  "Fira Code",
  "Hack",
  "Inconsolata",
  "JetBrains Mono",
  "Liberation Mono",
  "Menlo",
  "Monaco",
  "SF Mono",
  "Source Code Pro",

  // Modern UI & Sans-Serif Fonts
  "Arial",
  "Calibri",
  "Helvetica Neue",
  "Inter",
  "Roboto",
  "Segoe UI",
  "Segoe UI Variable Text",
  "Ubuntu",

  // Serif Fonts
  "Cambria",
  "Georgia",
  "Palatino Linotype",
  "Times New Roman",
];

interface LocalFontData {
  family: string;
  fullName?: string;
  postscriptName?: string;
  style?: string;
}

export async function getSystemFontFamilies(forceRefresh = false): Promise<string[]> {
  if (cachedFontFamilies && !forceRefresh) {
    return cachedFontFamilies;
  }

  const set = new Set<string>();

  // 1. Try modern Chromium/WebKit queryLocalFonts API
  if (typeof window !== "undefined" && "queryLocalFonts" in window) {
    try {
      const queryLocalFonts = (
        window as unknown as { queryLocalFonts: () => Promise<LocalFontData[]> }
      ).queryLocalFonts;
      const fonts = await queryLocalFonts();
      for (const f of fonts) {
        if (f.family && typeof f.family === "string") {
          const trimmed = f.family.trim();
          if (trimmed) {
            set.add(trimmed);
          }
        }
      }
    } catch (err) {
      console.warn("Could not query local fonts via Web API:", err);
    }
  }

  // 2. Merge with popular curated platform fonts
  for (const font of POPULAR_SYSTEM_FONTS) {
    set.add(font);
  }

  // Sort alphabetically case-insensitively
  const list = Array.from(set).toSorted((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  cachedFontFamilies = list;
  return list;
}

export function resolveEditorFontFamily(primary: string, fallback?: string): string {
  const parts: string[] = [];

  const cleanPrimary = primary?.trim() ?? "";
  if (cleanPrimary === "mono" || cleanPrimary === "System Mono") {
    parts.push("var(--editor-font-mono)");
  } else if (cleanPrimary === "serif" || cleanPrimary === "System Serif") {
    parts.push("var(--editor-font-serif)");
  } else if (cleanPrimary && cleanPrimary !== "sans" && cleanPrimary !== "System Sans") {
    parts.push(`"${cleanPrimary}"`);
  } else {
    parts.push("var(--editor-font-sans)");
  }

  if (fallback && fallback.trim()) {
    const cleanFallback = fallback.trim();
    if (cleanFallback !== cleanPrimary) {
      parts.push(`"${cleanFallback}"`);
    }
  }

  // Standard safe modern fallbacks (ensuring modern CJK sans fallback instead of archaic SimSun)
  parts.push(
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI Variable Text",
    "Segoe UI",
    "Hiragino Sans GB",
    "sans-serif",
    "Apple Color Emoji",
    "Segoe UI Emoji",
    "Segoe UI Symbol",
  );
  return parts.join(", ");
}
