import type { Settings } from "./settings";

export interface OpenedDocument {
  path: string;
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
  | "file.new"
  | "file.open"
  | "file.save"
  | "file.save-as"
  | "file.export-pdf"
  | "help.sample-document";

/** Channels the renderer calls through `ipcRenderer.invoke` and the main process implements with `ipcMain.handle`. */
export interface InvokeChannels {
  "settings:update": (patch: Partial<Settings>) => void;
  "settings:reveal": () => void;
  "document:open": () => OpenedDocument | null;
  "document:read": (path: string) => OpenedDocument;
  "document:write": (path: string, content: string) => void;
  "document:save-as": (suggestedName: string, content: string) => string | null;
  "document:export-pdf": (suggestedName: string) => string | null;
  "dialog:confirm-unsaved": (fileName: string) => UnsavedChoice;
  "dialog:show-error": (message: string, detail: string) => void;
  "window:open-settings": () => void;
  "app:show-about": () => void;
  "app:dispatch": (command: AppCommand) => void;
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
