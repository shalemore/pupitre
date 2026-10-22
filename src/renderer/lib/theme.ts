/**
 * A theme is themes/<name>/index.css. It is read with ?inline and wrapped into the document-theme style layer,
 * so a theme can override the app defaults while user preferences (the preferences layer) always override the theme.
 * Vite processes url() in themes, so fonts and images in the theme folder can be referenced by relative paths.
 */
const themeLoaders = import.meta.glob<string>("../themes/*/index.css", {
  query: "?inline",
  import: "default",
});

export const DEFAULT_THEME = "pupitre";

const otherThemes = Object.keys(themeLoaders)
  .map((path) => path.split("/").at(-2) ?? "")
  .filter((name) => name !== DEFAULT_THEME)
  .toSorted((a, b) => a.localeCompare(b));

/** The default theme comes first, the rest are sorted by name. */
export const THEME_NAMES: readonly string[] = [DEFAULT_THEME, ...otherThemes];

let styleElement: HTMLStyleElement | undefined;

export async function applyTheme(name: string): Promise<void> {
  const load =
    themeLoaders[`../themes/${name}/index.css`] ??
    themeLoaders[`../themes/${DEFAULT_THEME}/index.css`];
  if (!load) return;
  const css = await load();
  styleElement ??= document.head.appendChild(document.createElement("style"));
  styleElement.textContent = `@layer document-theme {\n${css}\n}`;
}

/** Converts any CSS color (themes often use oklch) to the #rrggbb the Electron window API needs. */
function toHex(color: string): string {
  const context = new OffscreenCanvas(1, 1).getContext("2d");
  if (!context) return "#000000";
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

/** Reads the current theme's canvas color and secondary text color for the window background and the Windows title bar buttons. */
export function readWindowColors(): { background: string; symbol: string } {
  const style = getComputedStyle(document.documentElement);
  return {
    background: toHex(style.getPropertyValue("--ui-surface-1")),
    symbol: toHex(style.getPropertyValue("--ui-text-secondary")),
  };
}
