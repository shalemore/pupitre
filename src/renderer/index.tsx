import { createEffect, createRoot, on } from "solid-js";
import { render } from "solid-js/web";
import { App } from "@/App";
import "@/app.css";
import { SettingsWindow } from "@/components/Settings/SettingsWindow";
import { currentDirection, currentLocale } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { editorFontFamily } from "@/lib/fonts";
import { settings } from "@/lib/settings";
import { applyTheme, readWindowColors } from "@/lib/theme";
import type { EditorWidth } from "@shared/settings";

const CONTENT_WIDTHS: Record<EditorWidth, string> = {
  compact: "42rem",
  normal: "52rem",
  wide: "64rem",
  full: "none",
};

const root = document.documentElement;
root.dataset["platform"] = desktop.platform;

const darkScheme = matchMedia("(prefers-color-scheme: dark)");
const syncWindowColors = () =>
  void desktop.invoke("window:set-colors", { ...readWindowColors(), dark: darkScheme.matches });
darkScheme.addEventListener("change", syncWindowColors);

// Load the theme before rendering, so the first frame does not flash with the default styles
await applyTheme(settings().theme);
syncWindowColors();

createRoot(() => {
  createEffect(
    on(
      () => settings().theme,
      async (name) => {
        await applyTheme(name);
        syncWindowColors();
      },
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
    const { fontSize, lineHeight, editorWidth, fontFamily, fallbackFont } = settings();
    root.style.setProperty("--pref-font-size", `${fontSize}px`);
    root.style.setProperty("--pref-line-height", String(lineHeight));
    root.style.setProperty("--pref-content-width", CONTENT_WIDTHS[editorWidth]);
    const family = editorFontFamily(fontFamily, fallbackFont);
    if (family) root.style.setProperty("--pref-font-family", family);
    else root.style.removeProperty("--pref-font-family");
  });
});

const container = document.getElementById("root");
if (container) {
  render(() => (location.hash === "#settings" ? <SettingsWindow /> : <App />), container);
}
