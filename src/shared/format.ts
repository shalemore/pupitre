/**
 * Formatting actions available from the Format menu, the context menu and the keyboard.
 * The shortcuts follow Typora's and are written as Electron accelerators; the editor turns them
 * into CodeMirror key names, so each shortcut is defined only here. The ids double as the keys
 * of the `format` section in the translation dictionaries.
 */
export const FORMAT_ACTIONS = [
  { id: "bold", shortcut: "CmdOrCtrl+B" },
  { id: "italic", shortcut: "CmdOrCtrl+I" },
  { id: "strikethrough", shortcut: "Alt+Shift+5" },
  { id: "inlineCode", shortcut: "CmdOrCtrl+Shift+`" },
  { id: "link", shortcut: "CmdOrCtrl+K" },
  { id: "paragraph", shortcut: "CmdOrCtrl+0" },
  { id: "heading1", shortcut: "CmdOrCtrl+1" },
  { id: "heading2", shortcut: "CmdOrCtrl+2" },
  { id: "heading3", shortcut: "CmdOrCtrl+3" },
  { id: "heading4", shortcut: "CmdOrCtrl+4" },
  { id: "heading5", shortcut: "CmdOrCtrl+5" },
  { id: "heading6", shortcut: "CmdOrCtrl+6" },
  { id: "quote", shortcut: "CmdOrCtrl+Shift+Q" },
  { id: "orderedList", shortcut: "CmdOrCtrl+Shift+[" },
  { id: "bulletList", shortcut: "CmdOrCtrl+Shift+]" },
  { id: "codeBlock", shortcut: "CmdOrCtrl+Shift+K" },
  { id: "mathBlock", shortcut: "CmdOrCtrl+Shift+M" },
  { id: "table", shortcut: "CmdOrCtrl+T" },
  { id: "divider", shortcut: undefined },
] as const;

export type FormatAction = (typeof FORMAT_ACTIONS)[number]["id"];

/** The Paragraph menu: groups of actions, a separator between them. */
export const PARAGRAPH_MENU_GROUPS: readonly (readonly FormatAction[])[] = [
  ["heading1", "heading2", "heading3", "heading4", "heading5", "heading6"],
  ["paragraph", "quote", "orderedList", "bulletList"],
  ["codeBlock", "mathBlock", "table", "divider"],
];

/** Inline formats offered first in the context menu. */
export const INLINE_FORMAT_ACTIONS = [
  "bold",
  "italic",
  "strikethrough",
  "inlineCode",
  "link",
] as const satisfies readonly FormatAction[];
