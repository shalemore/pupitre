/** The shortcut the main window handles itself. */
export type AppShortcut =
  | { kind: "zoom"; command: "in" | "out" | "reset" }
  | { kind: "toggleTheme" };

/** The part of a keystroke that a shortcut depends on. */
export type Keystroke = {
  type: string;
  key: string;
  control: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  isAutoRepeat: boolean;
};

/**
 * The character the keyboard produced decides the zoom, so the keypad's "+" and "-" and the
 * shifted paren of "0" need no spellings of their own.
 */
const ZOOM_BY_KEY = new Map<string, "in" | "out" | "reset">([
  ["+", "in"],
  ["=", "in"],
  ["-", "out"],
  ["0", "reset"],
  [")", "reset"],
]);

/**
 * The shortcut a keystroke asks for, if any. Electron's menu accelerators cannot be trusted with
 * these keys: `Ctrl+Plus` only fires with Shift held and needs both spellings, and "-" is not a
 * reliable key name (electron/electron#6731, electron/electron#15496). The window reads the key
 * itself instead, with the platform's command key held and Alt left alone.
 *
 * A held key repeats its key down: the zoom steps again as a browser does, while the theme ignores
 * the repeats so that holding the key cannot strobe the window. A new press always runs.
 */
export function shortcutOf(input: Keystroke, platform: NodeJS.Platform): AppShortcut | undefined {
  if (input.type !== "keyDown" || input.alt) return undefined;
  const command = platform === "darwin" ? input.meta : input.control;
  if (!command) return undefined;
  const key = input.key.toLowerCase();
  if (input.shift && key === "d") {
    return input.isAutoRepeat ? undefined : { kind: "toggleTheme" };
  }
  // The key the app reset the zoom with before the menu listed Ctrl+0
  if (input.shift && key === "r") return { kind: "zoom", command: "reset" };
  const zoom = ZOOM_BY_KEY.get(input.key);
  return zoom === undefined ? undefined : { kind: "zoom", command: zoom };
}
