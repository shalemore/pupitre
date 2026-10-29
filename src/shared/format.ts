/**
 * Formatting actions available from the Format menu, the context menu and the keyboard.
 * The shortcuts follow Typora's and are written as Electron accelerators; the editor turns them
 * into CodeMirror key names, so each shortcut is defined only here. The ids double as the keys
 * of the `format` section in the translation dictionaries.
 */
export const FORMAT_ACTIONS = [
  { id: "bold", shortcut: "CmdOrCtrl+B" },
  { id: "italic", shortcut: "CmdOrCtrl+I" },
  { id: "underline", shortcut: "CmdOrCtrl+U" },
  { id: "strikethrough", shortcut: "Alt+Shift+5" },
  { id: "highlight", shortcut: undefined },
  { id: "subscript", shortcut: undefined },
  { id: "superscript", shortcut: undefined },
  { id: "inlineCode", shortcut: "CmdOrCtrl+Shift+`" },
  { id: "link", shortcut: "CmdOrCtrl+K" },
  { id: "clearFormat", shortcut: "CmdOrCtrl+\\" },
  { id: "paragraph", shortcut: "CmdOrCtrl+0" },
  { id: "heading1", shortcut: "CmdOrCtrl+1" },
  { id: "heading2", shortcut: "CmdOrCtrl+2" },
  { id: "heading3", shortcut: "CmdOrCtrl+3" },
  { id: "heading4", shortcut: "CmdOrCtrl+4" },
  { id: "heading5", shortcut: "CmdOrCtrl+5" },
  { id: "heading6", shortcut: "CmdOrCtrl+6" },
  // The keys that step a heading belong to zoom, and Ctrl+0 is Paragraph, as in Typora
  { id: "headingUp", shortcut: undefined },
  { id: "headingDown", shortcut: undefined },
  { id: "quote", shortcut: "CmdOrCtrl+Shift+Q" },
  { id: "orderedList", shortcut: "CmdOrCtrl+Shift+[" },
  { id: "bulletList", shortcut: "CmdOrCtrl+Shift+]" },
  { id: "codeBlock", shortcut: "CmdOrCtrl+Shift+K" },
  { id: "mathBlock", shortcut: "CmdOrCtrl+Shift+M" },
  { id: "inlineMath", shortcut: undefined },
  { id: "table", shortcut: "CmdOrCtrl+T" },
  { id: "divider", shortcut: undefined },
  { id: "toc", shortcut: undefined },
  { id: "footnote", shortcut: undefined },
] as const;

export type FormatAction = (typeof FORMAT_ACTIONS)[number]["id"];

/** The shortcut a Format action shows, if it has one. */
export function shortcutOf(action: FormatAction): string | undefined {
  return FORMAT_ACTIONS.find(({ id }) => id === action)?.shortcut;
}

/** The Paragraph menu: groups of actions, a separator between them. */
export const PARAGRAPH_MENU_GROUPS: readonly (readonly FormatAction[])[] = [
  ["heading1", "heading2", "heading3", "heading4", "heading5", "heading6"],
  ["headingUp", "headingDown"],
  ["paragraph", "quote", "orderedList", "bulletList"],
  ["codeBlock", "mathBlock", "inlineMath", "table", "divider"],
  ["toc", "footnote"],
];

/** The Format menu: every inline format, in the order the menu lists them. */
export const INLINE_FORMAT_ACTIONS = [
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "highlight",
  "subscript",
  "superscript",
  "inlineCode",
  "link",
  "clearFormat",
] as const satisfies readonly FormatAction[];

/**
 * Inline formats offered first in the context menu, which its edit actions have to stay visible
 * next to; the rest are a menu bar or a shortcut away.
 */
export const CONTEXT_MENU_FORMAT_ACTIONS = [
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "highlight",
  "inlineCode",
  "link",
] as const satisfies readonly FormatAction[];
