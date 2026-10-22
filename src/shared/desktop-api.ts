import type { Settings } from "./settings";

export interface DocumentLocation {
  path: string;
  /** file:// URL of the document's folder (ending in /), used to resolve relative paths in the document. */
  baseUrl: string;
}

export interface OpenedDocument extends DocumentLocation {
  content: string;
}

/** The choice made when closing or replacing a document with unsaved changes. */
export type UnsavedChoice = "save" | "discard" | "cancel";

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; version: string; notes: string }
  | { kind: "up-to-date" }
  | { kind: "downloading"; percent: number }
  | { kind: "ready"; version: string }
  | { kind: "error"; message: string };

/** Commands the main process sends to the main window, triggered by the menu or other windows. */
export type AppCommand =
  | { id: "file.new" }
  | { id: "file.open" }
  | { id: "file.open-path"; path: string }
  | { id: "file.save" }
  | { id: "file.save-as" }
  | { id: "file.export-pdf" }
  | { id: "edit.find" }
  | { id: "edit.replace" }
  | { id: "view.toggle-sidebar" }
  | { id: "help.sample-document" };

/** Top-level menus of the application menu; Windows and Linux render them in the title bar and pop up the matching native submenu on click. */
export const TOP_MENUS = ["file", "edit", "view", "help"] as const;
export type TopMenu = (typeof TOP_MENUS)[number];

/** Window background and secondary text color under the current theme, used to avoid a flash before the window shows and to color the Windows title bar buttons. */
export interface WindowColors {
  background: string;
  symbol: string;
  dark: boolean;
}

/** Document state the renderer reports to the main process, used to enable or disable menu items. */
export interface DocumentState {
  hasDocument: boolean;
}

/** Channels the renderer calls through `ipcRenderer.invoke` and the main process implements with `ipcMain.handle`. */
export interface InvokeChannels {
  "settings:update": (patch: Partial<Settings>) => void;
  "settings:reveal": () => void;
  "document:open": () => OpenedDocument | null;
  "document:read": (path: string) => OpenedDocument;
  "document:write": (path: string, content: string) => void;
  "document:save-as": (suggestedName: string, content: string) => DocumentLocation | null;
  /** Saves an image into the assets folder next to the document and returns a relative path ready for Markdown. */
  "document:save-image": (documentPath: string, fileName: string, data: Uint8Array) => string;
  "document:export-pdf": (suggestedName: string) => string | null;
  "dialog:confirm-unsaved": (fileName: string) => UnsavedChoice;
  "dialog:show-error": (message: string, detail: string) => void;
  "window:open-settings": () => void;
  "window:set-colors": (colors: WindowColors) => void;
  "app:show-about": () => void;
  "app:dispatch": (command: AppCommand) => void;
  "menu:popup": (menu: TopMenu, x: number, y: number) => void;
  "menu:set-document-state": (state: DocumentState) => void;
  "updater:get-status": () => UpdateStatus;
  "updater:check": () => void;
  "updater:download": () => void;
  "updater:install": () => void;
}

/** Events the main process pushes to the renderer through `webContents.send`. */
export interface RendererEvents {
  "settings:changed": Settings;
  "updater:status": UpdateStatus;
  "app:command": AppCommand;
}

export const SETTINGS_GET_SYNC = "settings:get-sync";
export const SETTINGS_PATH_SYNC = "settings:path-sync";

export interface DesktopApi {
  readonly platform: "darwin" | "win32" | "linux";
  readonly versions: { electron: string; chrome: string };
  invoke<K extends keyof InvokeChannels>(
    channel: K,
    ...args: Parameters<InvokeChannels[K]>
  ): Promise<Awaited<ReturnType<InvokeChannels[K]>>>;
  on<K extends keyof RendererEvents>(
    channel: K,
    listener: (payload: RendererEvents[K]) => void,
  ): () => void;
  getSettings(): Settings;
  getSettingsPath(): string;
  getPathForFile(file: File): string;
}
