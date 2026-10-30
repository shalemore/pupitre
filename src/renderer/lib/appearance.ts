import { createPrefersDark } from "@solid-primitives/media";
import { createEffect, createMemo, createRoot } from "solid-js";
import { CONTENT_WIDTHS } from "@shared/settings";
import { currentDirection, currentLocale } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { codeFontFamily, documentFontFamily, interfaceFontFamily } from "@/lib/fonts";
import { settings } from "@/lib/settings";
import { applyTheme, DEFAULT_THEME, importedThemes, readWindowColors, themes } from "@/lib/theme";
import { clearToken, readToken, writeToken, type TokenName } from "@/lib/tokens";
import { withViewTransition } from "@/lib/view-transition";

/** Removes the variable when the value is undefined, so the stylesheet falls back to the theme. */
function setOptionalProperty(name: TokenName, value: string | undefined): void {
  if (value === undefined) clearToken(document.documentElement.style, name);
  else writeToken(document.documentElement.style, name, value);
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
      const available = (id: string) => themes().some((candidate) => candidate.id === id);
      // A theme folder removed since it was chosen gives the light theme back to the default
      const light = available(theme) ? theme : DEFAULT_THEME;
      if (isDark() && darkTheme !== "") return available(darkTheme) ? darkTheme : light;
      return light;
    });

    // Effects run in creation order: the theme is applied before anything reads its values
    let shownTheme: string | undefined;
    createEffect(() => {
      // A theme folder added, changed or removed while the app runs replaces the active CSS too
      importedThemes();
      const id = activeTheme();
      const apply = () => {
        applyTheme(id);
        void desktop.invoke("window:set-colors", { ...readWindowColors(), dark: isDark() });
      };
      // The theme the window opens with is already the first paint; a later one cross-fades its
      // colors in, together with the window frame the main process draws. The list of imported
      // themes arriving changes nothing to fade.
      if (shownTheme !== undefined && shownTheme !== id) withViewTransition(apply);
      else apply();
      shownTheme = id;
    });
    createEffect(() => {
      root.lang = currentLocale();
      root.dir = currentDirection();
    });
    createEffect(() => {
      root.dataset["motion"] = settings().animations;
    });
    // Layout and typography preferences become CSS variables, read by the stylesheet
    createEffect(() => {
      const {
        fontSize,
        lineHeight,
        contentWidth,
        immersiveGap,
        bodyFont,
        fallbackFont,
        codeFont,
        uiFont,
      } = settings();
      // The theme brings the fonts the stacks below fall back to, so a change of theme rebuilds them
      activeTheme();
      const themeStyle = getComputedStyle(root);
      const themeFonts = readToken(themeStyle, "font-document");
      const fontStackIntent =
        readToken(themeStyle, "font-stack-intent") === "mono" ? "mono" : "text";
      writeToken(root.style, "pref-font-size", `${fontSize}px`);
      writeToken(root.style, "pref-line-height", String(lineHeight));
      writeToken(root.style, "pref-content-width", CONTENT_WIDTHS[contentWidth]);
      writeToken(root.style, "pref-immersive-gap", `${immersiveGap}px`);
      setOptionalProperty(
        "pref-font-family",
        documentFontFamily(bodyFont, fallbackFont, themeFonts, fontStackIntent),
      );
      setOptionalProperty(
        "pref-code-font",
        codeFontFamily(codeFont, fallbackFont, readToken(themeStyle, "font-mono"), fontStackIntent),
      );
      setOptionalProperty("pref-ui-font", interfaceFontFamily(uiFont, fallbackFont));
    });
  });
}
