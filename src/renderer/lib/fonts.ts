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

/** Font families that name a class of faces rather than a face, so they never identify a theme's font. */
export const GENERIC_FAMILIES: ReadonlySet<string> = new Set([
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
 * How a theme wants the fallback font placed. A monospace theme asks for `mono`, which puts the
 * user's fallback after the generic families: a CJK fallback before `monospace` would take the
 * Chinese text out of the grid the theme is built on.
 */
export type FontStackIntent = "text" | "mono";

/**
 * A font stack with the user's choices put in front of the theme's: the chosen font replaces the
 * theme's specific families and the fallback font comes next. In a text theme the fallback must
 * come before the generic families (sans-serif and so on): a generic family maps to a system font,
 * which on a Chinese system already has Chinese glyphs, so a fallback placed after it would never
 * be reached. A `mono` theme reverses that, keeping the grid of the fallback face. Undefined when
 * nothing is chosen, which leaves everything to the theme.
 */
function userFontStack(
  font: string,
  fallbackFont: string,
  themeStack: string,
  defaultGeneric: string,
  intent: FontStackIntent,
  /** Keep the theme's own faces behind the chosen one, for the scripts it covers better. */
  keepSpecific = false,
): string | undefined {
  if (!font && !fallbackFont) return undefined;
  const themeFamilies = themeStack
    .split(",")
    .map((family) => family.trim())
    .filter((family) => family !== "");
  const specific = themeFamilies.filter((family) => !GENERIC_FAMILIES.has(family));
  const generic = themeFamilies.filter((family) => GENERIC_FAMILIES.has(family));
  const fallback = fallbackFont ? [quote(fallbackFont)] : [];
  const genericFamilies = generic.length > 0 ? generic : [defaultGeneric];
  const families = [
    ...(font ? [quote(font), ...(keepSpecific ? specific : [])] : specific),
    ...(intent === "mono" ? genericFamilies : fallback),
    ...(intent === "mono" ? fallback : genericFamilies),
  ];
  return families.join(", ");
}

/** The body font stack; themeStack is the computed value of the theme's --font-document. */
export function documentFontFamily(
  bodyFont: string,
  fallbackFont: string,
  themeStack: string,
  intent: FontStackIntent,
): string | undefined {
  return userFontStack(bodyFont, fallbackFont, themeStack, "sans-serif", intent);
}

/** The interface font; a chosen face comes first, then the fallback font, then the theme's stack. */
export function interfaceFontFamily(uiFont: string, fallbackFont: string): string | undefined {
  // With no choice of its own the interface stays on the theme's --font-sans, which a fallback
  // font placed in front of it would replace rather than complement
  if (!uiFont) return undefined;
  const fallback = fallbackFont ? `${quote(fallbackFont)}, ` : "";
  return `${quote(uiFont)}, ${fallback}var(--font-sans)`;
}

/**
 * The code font stack; themeStack is the computed value of the theme's --font-mono. Code takes the
 * fallback font too, placed the way the document places it, so Chinese in comments matches the
 * body. A chosen code font keeps the theme's own mono faces behind it: they are what carries
 * Chinese in code when the chosen face has none.
 */
export function codeFontFamily(
  codeFont: string,
  fallbackFont: string,
  themeStack: string,
  intent: FontStackIntent,
): string | undefined {
  return userFontStack(codeFont, fallbackFont, themeStack, "monospace", intent, true);
}
