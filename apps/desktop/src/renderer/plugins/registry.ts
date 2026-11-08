import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { TrustedPlugin } from "@pupitre/plugin-sdk/trusted";
import { writingModes } from "@pupitre/plugin-writing-modes";
import type { Settings } from "@pupitre/settings";

/**
 * The trusted plugins compiled into the app, in the order their extensions reach the editor.
 * They read the app's own settings, so a setting the user already had keeps its meaning.
 */
const builtinPlugins: readonly TrustedPlugin<Settings>[] = [writingModes];

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
