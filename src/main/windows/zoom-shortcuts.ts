/** The zoom a keystroke asks for. */
export type ZoomCommand = "in" | "out" | "reset";

/** The part of a keystroke that a zoom shortcut depends on. */
export type ZoomKeystroke = {
  type: string;
  key: string;
  control: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
};

/**
 * The character the keyboard produced decides the zoom, so the keypad's "+" and "-" and the
 * shifted paren of "0" need no spellings of their own.
 */
const BY_KEY = new Map<string, ZoomCommand>([
  ["+", "in"],
  ["=", "in"],
  ["-", "out"],
  ["0", "reset"],
  [")", "reset"],
]);

/**
 * The zoom a keystroke asks for, if any. Electron's menu accelerators cannot be trusted with these
 * keys: `Ctrl+Plus` only fires with Shift held and needs both spellings, and "-" is not a reliable
 * key name (electron/electron#6731, electron/electron#15496). The window reads the key itself
 * instead, with the platform's command key held and Alt left alone.
 */
export function zoomCommandOf(
  input: ZoomKeystroke,
  platform: NodeJS.Platform,
): ZoomCommand | undefined {
  if (input.type !== "keyDown" || input.alt) return undefined;
  const command = platform === "darwin" ? input.meta : input.control;
  if (!command) return undefined;
  // The key the app reset the zoom with before the menu listed Ctrl+0
  if (input.key.toLowerCase() === "r" && input.shift) return "reset";
  return BY_KEY.get(input.key);
}
