/** A single face returned by the Local Font Access API (one entry per weight and style of a family). */
interface LocalFontData {
  readonly family: string;
  readonly fullName: string;
  readonly style: string;
}

declare global {
  interface Window {
    queryLocalFonts?: () => Promise<LocalFontData[]>;
  }
}

export interface FontFamily {
  family: string;
  /** Name in the system language, for example "HarmonyOS Sans SC" is localized on a Chinese system; undefined when it equals the family. */
  localizedName: string | undefined;
}

/** Chromium refuses to query fonts while the page is hidden, so wait until the window is shown. */
function whenVisible(): Promise<void> {
  if (document.visibilityState === "visible") return Promise.resolve();
  return new Promise((resolve) => {
    const handleChange = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", handleChange);
      resolve();
    };
    document.addEventListener("visibilitychange", handleChange);
  });
}

/**
 * Reads the fonts actually installed on the system (including per-user installs) with Chromium's queryLocalFonts,
 * merged by family. The fullName of the regular face is the display name in the system language, used for localized names and search.
 */
async function queryFontFamilies(): Promise<FontFamily[]> {
  await whenVisible();
  const faces = (await window.queryLocalFonts?.()) ?? [];
  const families = new Map<string, FontFamily>();
  for (const face of faces) {
    const existing = families.get(face.family);
    const isRegular = face.style === "Regular" || face.style === "Normal";
    if (existing && !isRegular) continue;
    // A localized full name is usually "name + weight"; the regular face has no weight suffix and is closest to the family name
    const localized = face.fullName.replace(/\s+(Regular|Normal)$/i, "");
    families.set(face.family, {
      family: face.family,
      localizedName: isRegular && !localized.startsWith(face.family) ? localized : undefined,
    });
  }
  return [...families.values()].toSorted((a, b) =>
    a.family.localeCompare(b.family, undefined, { sensitivity: "base" }),
  );
}

let cached: Promise<FontFamily[]> | undefined;

export function listFontFamilies(refresh = false): Promise<FontFamily[]> {
  if (refresh || !cached) cached = queryFontFamilies().catch(() => []);
  return cached;
}

/** Font names are quoted before going into font-family; otherwise names with spaces or a leading digit are parsed wrongly. */
function quote(family: string): string {
  return JSON.stringify(family);
}

const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
  "fangsong",
]);

/**
 * The body font the user chose; undefined when nothing is chosen, which leaves everything to the theme.
 * The fallback font must come before generic families (sans-serif and so on): a generic family maps to a system font,
 * which on a Chinese system already has Chinese glyphs, so a fallback placed after it would never be reached.
 * themeStack is the computed value of the theme's --font-document.
 */
export function documentFontFamily(
  bodyFont: string,
  fallbackFont: string,
  themeStack: string,
): string | undefined {
  if (!bodyFont && !fallbackFont) return undefined;
  const themeFamilies = themeStack
    .split(",")
    .map((family) => family.trim())
    .filter((family) => family !== "");
  const specific = themeFamilies.filter((family) => !GENERIC_FAMILIES.has(family));
  const generic = themeFamilies.filter((family) => GENERIC_FAMILIES.has(family));
  const families = [
    ...(bodyFont ? [quote(bodyFont)] : specific),
    ...(fallbackFont ? [quote(fallbackFont)] : []),
    ...(generic.length > 0 ? generic : ["sans-serif"]),
  ];
  return families.join(", ");
}

/** The interface font; characters it lacks fall back to the editor's fallback font first. */
export function interfaceFontFamily(uiFont: string, fallbackFont: string): string | undefined {
  if (!uiFont) return undefined;
  const fallback = fallbackFont ? `${quote(fallbackFont)}, ` : "";
  return `${quote(uiFont)}, ${fallback}var(--font-sans)`;
}

export function codeFontFamily(codeFont: string): string | undefined {
  return codeFont ? `${quote(codeFont)}, var(--font-mono)` : undefined;
}
