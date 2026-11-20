/**
 * The accelerators the app gives its commands, written as Electron reads them. The native menu, the
 * drawn menu of the web demo and the window's own key reader all take them from here, so a key that
 * changes changes everywhere it is shown or handled.
 *
 * The window reads the zoom and theme keys itself: Electron's accelerators cannot be trusted with
 * punctuation, and a held theme key must not strobe the window (see windows/shortcuts.ts).
 */
export const SHORTCUTS = {
  preferences: "CmdOrCtrl+,",
  newFile: "CmdOrCtrl+N",
  openFile: "CmdOrCtrl+O",
  openFolder: "CmdOrCtrl+Shift+O",
  quickOpen: "CmdOrCtrl+P",
  save: "CmdOrCtrl+S",
  saveAs: "CmdOrCtrl+Shift+S",
  closeTab: "CmdOrCtrl+W",
  reopenTab: "CmdOrCtrl+Shift+T",
  closeWindow: "CmdOrCtrl+Shift+W",
  copyHtml: "CmdOrCtrl+Shift+C",
  pastePlain: "CmdOrCtrl+Shift+V",
  find: "CmdOrCtrl+F",
  searchWorkspace: "CmdOrCtrl+Shift+F",
  insertImage: "CmdOrCtrl+Shift+I",
  commandPalette: "CmdOrCtrl+Shift+P",
  toggleSidebar: "CmdOrCtrl+Shift+L",
  toggleTheme: "CmdOrCtrl+Shift+D",
  nextTab: "Control+Tab",
  previousTab: "Control+Shift+Tab",
  focusMode: "F8",
  typewriterMode: "F9",
  sourceMode: "CmdOrCtrl+/",
  zoomIn: "CmdOrCtrl+Plus",
  zoomOut: "CmdOrCtrl+-",
  resetZoom: "CmdOrCtrl+0",
  /** The key the app reset the zoom with before the menu listed Ctrl+0. */
  legacyResetZoom: "CmdOrCtrl+Shift+R",
} as const;

/** Replace is the one command whose key each platform writes differently. */
export function replaceShortcut(platform: string): string {
  return platform === "darwin" ? "Cmd+Alt+F" : "Ctrl+H";
}
