import { desktop } from "@pupitre/desktop-api/client";
import { currentDirection, currentLocale } from "@pupitre/i18n/solid";
import { CONTENT_WIDTHS } from "@pupitre/settings";
import { createPrefersDark } from "@solid-primitives/media";
import { createEffect, createMemo, createRoot } from "solid-js";
import { codeFontFamily, documentFontFamily, interfaceFontFamily } from "@/lib/fonts";
import { settings } from "@/lib/settings";
import { applyThemeCss, DEFAULT_THEME, readWindowColors, themeCss, themes } from "@/lib/theme";
import { clearToken, readToken, writeToken, type TokenName } from "@/lib/tokens";
import { withViewTransition } from "@/lib/view-transition";

/** Removes the variable when the value is undefined, so the stylesheet falls back to the theme. */
function setOptionalProperty(name: TokenName, value: string | undefined): void {
  if (value === undefined) clearToken(document.documentElement.style, name);
  else writeToken(document.documentElement.style, name, value);
}

const appearance = createRoot(() => {
  const isDark = createPrefersDark();

  const activeTheme = createMemo(() => {
    const { theme, darkTheme } = settings();
    const available = (id: string) => themes().some((candidate) => candidate.id === id);
    // A theme folder removed since it was chosen gives the light theme back to the default
    const light = available(theme) ? theme : DEFAULT_THEME;
    if (isDark() && darkTheme !== "") return available(darkTheme) ? darkTheme : light;
    return light;
  });

  // The CSS is resolved where the change is seen: a theme folder added, changed or removed while
  // the app runs replaces the stylesheet of the theme that uses it, and the memo hands the effect
  // a new value only when the theme, that CSS or the dark preference changed
  const shown = createMemo(() => {
    const id = activeTheme();
    return { id, css: themeCss(id), dark: isDark() };
  });

  return { activeTheme, shown };
});

/** The active theme, its CSS and the dark preference; read it to redo work that copies theme colors. */
export const shownTheme = appearance.shown;

/**
 * Makes the window follow the settings: theme, text direction, motion and typography.
 * Called once per window before the first render, so the first paint already uses the theme.
 */
export function setupAppearance(): void {
  const root = document.documentElement;
  root.dataset["platform"] = desktop.platform;
  const { activeTheme } = appearance;

  createRoot(() => {
    // Effects run in creation order: the theme is applied before anything reads its values
    let appliedTheme: string | undefined;
    createEffect(shownTheme, ({ id, css, dark }) => {
      const apply = () => {
        applyThemeCss(css);
        void desktop.invoke("window:set-colors", { ...readWindowColors(), dark });
      };
      // The theme the window opens with is already the first paint; a later one cross-fades its
      // colors in, together with the window frame the main process draws. A stylesheet that
      // changed under the same name arrives without a fade, since the theme it belongs to did not.
      if (appliedTheme !== undefined && appliedTheme !== id) withViewTransition(apply);
      else apply();
      appliedTheme = id;
    });
    createEffect(
      () => [currentLocale(), currentDirection()] as const,
      ([locale, direction]) => {
        root.lang = locale;
        root.dir = direction;
      },
    );
    createEffect(
      () => settings().animations,
      (animations) => {
        root.dataset["motion"] = animations;
      },
    );
    // Layout and typography preferences become CSS variables, read by the stylesheet
    createEffect(
      () => {
        // The theme brings the fonts the stacks below fall back to, so a change of theme rebuilds them
        activeTheme();
        return settings();
      },
      ({
        fontSize,
        lineHeight,
        contentWidth,
        immersiveGap,
        bodyFont,
        fallbackFont,
        codeFont,
        uiFont,
      }) => {
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
          codeFontFamily(
            codeFont,
            fallbackFont,
            readToken(themeStyle, "font-mono"),
            fontStackIntent,
          ),
        );
        setOptionalProperty("pref-ui-font", interfaceFontFamily(uiFont, fallbackFont));
      },
    );
  });
}
