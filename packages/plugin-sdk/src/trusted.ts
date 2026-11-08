import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

/**
 * A plugin compiled into the app. Unlike a third-party plugin it runs beside the editor and may
 * return CodeMirror extensions; `S` is the part of the app's settings it reads.
 */
export interface TrustedPlugin<S extends object = Record<string, unknown>> {
  /** Names the plugin in the app and its diagnostics. */
  id: string;
  /** The editor extensions for the current settings; empty while the plugin does nothing. */
  editor(settings: S): Extension;
  /**
   * Whether a document keeps the scroll place it was saved at. Typewriter mode scrolls the line
   * itself, so restoring the old top line would fight it.
   */
  restoresScroll?(settings: S): boolean;
  /**
   * Runs after the editor took the new extensions, for a change the extensions cannot express,
   * such as scrolling to the caret. `previous` is the settings the editor had before.
   */
  onSettingsChanged?(view: EditorView, settings: S, previous: S): void;
}

/** Names a plugin compiled into the app, keeping the settings type for its hooks. */
export function defineTrustedPlugin<S extends object>(plugin: TrustedPlugin<S>): TrustedPlugin<S> {
  return plugin;
}
