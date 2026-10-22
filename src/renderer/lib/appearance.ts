import type { ContentWidth } from "@shared/settings";
import { createEffect, createRoot, createSignal, on } from "solid-js";
import { currentDirection, currentLocale } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { codeFontFamily, documentFontFamily } from "@/lib/fonts";
import { settings } from "@/lib/settings";
import { applyTheme, readWindowColors } from "@/lib/theme";

const CONTENT_WIDTHS: Record<ContentWidth, string> = {
  compact: "42rem",
  normal: "52rem",
  wide: "64rem",
  full: "none",
};

/** Removes the variable when the value is undefined, so styles fall back to the theme's default. */
function setOptionalProperty(name: string, value: string | undefined): void {
  if (value === undefined) document.documentElement.style.removeProperty(name);
  else document.documentElement.style.setProperty(name, value);
}

/**
 * Makes the window's appearance follow the settings: theme, text direction, animation preference and typography preferences.
 * Called once when each window starts; the returned promise resolves after the theme styles have loaded, and rendering afterwards avoids a flash.
 */
export async function setupAppearance(): Promise<void> {
  const root = document.documentElement;
  root.dataset["platform"] = desktop.platform;

  const darkScheme = matchMedia("(prefers-color-scheme: dark)");
  const syncWindowColors = () =>
    void desktop.invoke("window:set-colors", { ...readWindowColors(), dark: darkScheme.matches });
  darkScheme.addEventListener("change", syncWindowColors);

  // Incremented once a theme has loaded so effects that depend on computed theme values (such as --font-document) run again
  const [themeRevision, setThemeRevision] = createSignal(0);
  const loadTheme = async (name: string) => {
    await applyTheme(name);
    syncWindowColors();
    setThemeRevision((revision) => revision + 1);
  };

  await loadTheme(settings().theme);

  createRoot(() => {
    createEffect(
      on(
        () => settings().theme,
        (name) => void loadTheme(name),
        { defer: true },
      ),
    );
    createEffect(() => {
      root.lang = currentLocale();
      root.dir = currentDirection();
    });
    createEffect(() => {
      root.dataset["motion"] = settings().animations;
    });
    // Typography preferences are written as CSS variables and applied to the document by the preferences layer in features/editor/editor.css
    createEffect(() => {
      const { fontSize, lineHeight, contentWidth, bodyFont, fallbackFont, codeFont } = settings();
      root.style.setProperty("--pref-font-size", `${fontSize}px`);
      root.style.setProperty("--pref-line-height", String(lineHeight));
      root.style.setProperty("--pref-content-width", CONTENT_WIDTHS[contentWidth]);
      themeRevision();
      const themeStack = getComputedStyle(root).getPropertyValue("--font-document");
      setOptionalProperty(
        "--pref-font-family",
        documentFontFamily(bodyFont, fallbackFont, themeStack),
      );
      setOptionalProperty("--pref-code-font", codeFontFamily(codeFont));
    });
  });
}
