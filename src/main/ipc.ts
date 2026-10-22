import { readFile, writeFile } from "node:fs/promises";
import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent, shell } from "electron";
import {
  type InvokeChannels,
  type OpenedDocument,
  SETTINGS_GET_SYNC,
  SETTINGS_PATH_SYNC,
} from "@shared/desktop-api";
import { showAboutDialog } from "./about";
import { t } from "./i18n";
import { popupTopMenu, setDocumentState } from "./menu";
import { addRecentFile, getSettings, getSettingsPath, updateSettings } from "./settings-store";
import { checkForUpdates, downloadUpdate, getUpdateStatus, installUpdate } from "./updater";
import { dispatchToMainWindow, showSettingsWindow } from "./windows";

function handle<K extends keyof InvokeChannels>(
  channel: K,
  handler: (
    event: IpcMainInvokeEvent,
    ...args: Parameters<InvokeChannels[K]>
  ) => ReturnType<InvokeChannels[K]> | Promise<ReturnType<InvokeChannels[K]>>,
): void {
  ipcMain.handle(channel, handler);
}

function senderWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) throw new Error("IPC sender is not attached to a window");
  return window;
}

async function readDocument(path: string): Promise<OpenedDocument> {
  try {
    const content = await readFile(path, "utf8");
    addRecentFile(path);
    // Strip the UTF-8 BOM; it is not written back on save either
    return { path, content: content.replace(/^﻿/, "") };
  } catch (error) {
    updateSettings({ recentFiles: getSettings().recentFiles.filter((p) => p !== path) });
    throw error;
  }
}

export function registerIpcHandlers(): void {
  ipcMain.on(SETTINGS_GET_SYNC, (event) => {
    event.returnValue = getSettings();
  });
  ipcMain.on(SETTINGS_PATH_SYNC, (event) => {
    event.returnValue = getSettingsPath();
  });
  handle("settings:update", (_event, patch) => updateSettings(patch));
  handle("settings:reveal", () => shell.showItemInFolder(getSettingsPath()));

  handle("document:open", async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(senderWindow(event), {
      properties: ["openFile"],
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown", "txt"] }],
    });
    const [path] = filePaths;
    if (canceled || path === undefined) return null;
    return readDocument(path);
  });
  handle("document:read", (_event, path) => readDocument(path));
  handle("document:write", async (_event, path, content) => {
    await writeFile(path, content, "utf8");
  });
  handle("document:save-as", async (event, suggestedName, content) => {
    const { canceled, filePath } = await dialog.showSaveDialog(senderWindow(event), {
      defaultPath: suggestedName,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (canceled || !filePath) return null;
    await writeFile(filePath, content, "utf8");
    addRecentFile(filePath);
    return filePath;
  });
  handle("document:export-pdf", async (event, suggestedName) => {
    const { canceled, filePath } = await dialog.showSaveDialog(senderWindow(event), {
      defaultPath: suggestedName,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (canceled || !filePath) return null;
    const pdf = await event.sender.printToPDF({ printBackground: true, pageSize: "A4" });
    await writeFile(filePath, pdf);
    return filePath;
  });

  handle("dialog:confirm-unsaved", async (event, fileName) => {
    const labels = t().dialogs;
    const { response } = await dialog.showMessageBox(senderWindow(event), {
      type: "warning",
      message: labels.unsavedMessage(fileName),
      detail: labels.unsavedDetail,
      buttons: [labels.save, labels.dontSave, labels.cancel],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    return response === 0 ? "save" : response === 1 ? "discard" : "cancel";
  });
  handle("dialog:show-error", async (event, message, detail) => {
    await dialog.showMessageBox(senderWindow(event), {
      type: "error",
      message,
      detail,
      noLink: true,
    });
  });

  handle("window:open-settings", () => showSettingsWindow());
  handle("app:show-about", (event) => showAboutDialog(senderWindow(event)));
  handle("app:dispatch", (_event, command) => dispatchToMainWindow(command));
  handle("menu:popup", (event, menu, x, y) => popupTopMenu(senderWindow(event), menu, x, y));
  handle("menu:set-document-state", (_event, state) => setDocumentState(state));

  // When an update fails, autoUpdater emits an error event and the status is updated, so it is not rethrown to the renderer
  handle("updater:get-status", () => getUpdateStatus());
  handle("updater:check", () => checkForUpdates().catch(() => {}));
  handle("updater:download", () => downloadUpdate().catch(() => {}));
  handle("updater:install", () => installUpdate());
}
