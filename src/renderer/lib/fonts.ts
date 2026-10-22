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

/** The body font the user chose; undefined leaves the font to the theme. */
export function editorFontFamily(primary: string, fallback: string): string | undefined {
  const families: string[] = [];
  if (primary === "mono") families.push("var(--font-mono)");
  else if (primary === "serif") families.push("ui-serif", "Georgia", "serif");
  else if (primary && primary !== "sans") families.push(JSON.stringify(primary));
  if (fallback && fallback !== primary) families.push(JSON.stringify(fallback));
  if (families.length === 0) return undefined;
  // With only a fallback font chosen, use the interface font first and let the fallback fill in missing glyphs
  if (primary === "sans" || !primary) families.unshift("var(--font-sans)");
  families.push("sans-serif");
  return families.join(", ");
}
