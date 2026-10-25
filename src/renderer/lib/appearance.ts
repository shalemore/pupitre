import { createPrefersDark } from "@solid-primitives/media";
import { createEffect, createMemo, createRoot } from "solid-js";
import type { ContentWidth } from "@shared/settings";
import { currentDirection, currentLocale } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { codeFontFamily, documentFontFamily, interfaceFontFamily } from "@/lib/fonts";
import { settings } from "@/lib/settings";
import { applyTheme, readWindowColors } from "@/lib/theme";

const CONTENT_WIDTHS: Record<ContentWidth, string> = {
  compact: "42rem",
  normal: "52rem",
  wide: "64rem",
  full: "none",
};

/** Removes the variable when the value is undefined, so the stylesheet falls back to the theme. */
function setOptionalProperty(name: string, value: string | undefined): void {
  if (value === undefined) document.documentElement.style.removeProperty(name);
  else document.documentElement.style.setProperty(name, value);
}

/**
 * Makes the window follow the settings: theme, text direction, motion and typography.
 * Called once per window before the first render, so the first paint already uses the theme.
 */
export function setupAppearance(): void {
  const root = document.documentElement;
  root.dataset["platform"] = desktop.platform;

  createRoot(() => {
    const isDark = createPrefersDark();

    const activeTheme = createMemo(() => {
      const { theme, darkTheme } = settings();
      return isDark() && darkTheme !== "" ? darkTheme : theme;
    });

    // Effects run in creation order: the theme is applied before anything reads its values
    createEffect(() => {
      applyTheme(activeTheme());
      void desktop.invoke("window:set-colors", { ...readWindowColors(), dark: isDark() });
    });
    createEffect(() => {
      root.lang = currentLocale();
      root.dir = currentDirection();
    });
    createEffect(() => {
      root.dataset["motion"] = settings().animations;
    });
    // Typography preferences become CSS variables used by the `preferences` layer
    createEffect(() => {
      const { fontSize, lineHeight, contentWidth, bodyFont, fallbackFont, codeFont, uiFont } =
        settings();
      activeTheme();
      const themeStyle = getComputedStyle(root);
      const themeFonts = themeStyle.getPropertyValue("--font-document");
      root.style.setProperty("--pref-font-size", `${fontSize}px`);
      root.style.setProperty("--pref-line-height", String(lineHeight));
      root.style.setProperty("--pref-content-width", CONTENT_WIDTHS[contentWidth]);
      setOptionalProperty(
        "--pref-font-family",
        documentFontFamily(bodyFont, fallbackFont, themeFonts),
      );
      setOptionalProperty(
        "--pref-code-font",
        codeFontFamily(codeFont, fallbackFont, themeStyle.getPropertyValue("--font-mono")),
      );
      setOptionalProperty("--pref-ui-font", interfaceFontFamily(uiFont, fallbackFont));
    });
  });
}
