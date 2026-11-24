import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { desktop } from "@pupitre/desktop-api/client";
import type { TrustedPlugin } from "@pupitre/plugin-sdk/trusted";
import { configureSourceModeHost, sourceMode } from "@pupitre/plugin-source-mode";
import { writingModes } from "@pupitre/plugin-writing-modes";
import type { Settings } from "@pupitre/settings";
import { openImageMenu } from "@/features/editor/image-menu";
import { motionEnabled, scrollTiming } from "@/lib/motion";

/**
 * The trusted plugins compiled into the app, in the order their extensions reach the editor.
 * They read the app's own settings, so a setting the user already had keeps its meaning.
 */
const builtinPlugins: readonly TrustedPlugin<Settings>[] = [writingModes, sourceMode];

if (typeof document !== "undefined") {
  const css = builtinPlugins
    .map((plugin) => plugin.styles)
    .filter((entry): entry is string => entry !== undefined)
    .join("\n");
  if (css !== "" && document.querySelector("style[data-trusted-plugin-styles]") === null) {
    const element = document.createElement("style");
    element.dataset["trustedPluginStyles"] = "";
    element.textContent = css;
    document.head.append(element);
  }
}

// The rendering draws with the app's own chrome and follows its animation setting
configureSourceModeHost({
  openImageMenu,
  openFile: (path) => void desktop.invoke("app:dispatch", { id: "file.open-path", path }),
  copyText: (text) => desktop.invoke("clipboard:write-text", text),
  motionEnabled,
  scrollTiming,
});

/** The editor extensions every enabled plugin contributes for these settings. */
export function pluginExtensions(settings: Settings): Extension {
  return builtinPlugins.map((plugin) => plugin.editor(settings));
}

/** Whether every enabled plugin leaves the saved scroll place to the editor. */
export function restoresScroll(settings: Settings): boolean {
  return builtinPlugins.every((plugin) => plugin.restoresScroll?.(settings) ?? true);
}

/** Runs the hooks a settings change needs after the editor took the new extensions. */
export function pluginSettingsChanged(
  view: EditorView,
  settings: Settings,
  previous: Settings,
): void {
  for (const plugin of builtinPlugins) plugin.onSettingsChanged?.(view, settings, previous);
}
