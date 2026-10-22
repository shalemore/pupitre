import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent, shell } from "electron";
import {
  type DocumentLocation,
  type InvokeChannels,
  type LineEnding,
  type OpenedDocument,
  SETTINGS_GET_SYNC,
  SETTINGS_PATH_SYNC,
} from "@shared/desktop-api";
import { showAboutDialog } from "./about";
import { t } from "./i18n";
import { popupTopMenu, setDocumentState } from "./menu";
import { addRecentFile, getSettings, getSettingsPath, updateSettings } from "./settings-store";
import { checkForUpdates, downloadUpdate, getUpdateStatus, installUpdate } from "./updater";
import {
  applyWindowColors,
  closeWithoutPrompt,
  dispatchToMainWindow,
  setDocumentEdited,
  showSettingsWindow,
} from "./windows";

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

function locate(path: string): DocumentLocation {
  return { path, baseUrl: pathToFileURL(join(dirname(path), "/")).href };
}

async function saveImage(
  documentPath: string,
  fileName: string,
  data: Uint8Array,
): Promise<string> {
  const folder = getSettings().imageFolder;
  const directory = join(dirname(documentPath), folder);
  await mkdir(directory, { recursive: true });
  // Pasted screenshots are usually all named image.png; a timestamp keeps them from overwriting existing images
  const extension = extname(fileName) || ".png";
  const stem = basename(fileName, extension).replace(/[^\p{L}\p{N}._-]+/gu, "-");
  const name = `${stem}-${Date.now()}${extension}`;
  await writeFile(join(directory, name), data, { flag: "wx" });
  // Paths in Markdown use / and each segment is encoded for spaces and other special characters
  return [...folder.split(/[\\/]+/), name].map(encodeURIComponent).join("/");
}

async function readDocument(path: string): Promise<OpenedDocument> {
  try {
    // Strip the UTF-8 BOM (not written back on save) and normalize line endings to \n; the original line ending is restored on save
    const raw = (await readFile(path, "utf8")).replace(/^﻿/, "");
    addRecentFile(path);
    return {
      ...locate(path),
      content: raw.replaceAll("\r\n", "\n"),
      lineEnding: raw.includes("\r\n") ? "crlf" : "lf",
    };
  } catch (error) {
    updateSettings({ recentFiles: getSettings().recentFiles.filter((p) => p !== path) });
    throw error;
  }
}

function writeDocument(path: string, content: string, lineEnding: LineEnding): Promise<void> {
  return writeFile(
    path,
    lineEnding === "crlf" ? content.replaceAll("\n", "\r\n") : content,
    "utf8",
  );
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
  handle("document:write", (_event, path, content, lineEnding) =>
    writeDocument(path, content, lineEnding),
  );
  handle("document:save-as", async (event, suggestedName, content, lineEnding) => {
    const { canceled, filePath } = await dialog.showSaveDialog(senderWindow(event), {
      defaultPath: suggestedName,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (canceled || !filePath) return null;
    await writeDocument(filePath, content, lineEnding);
    addRecentFile(filePath);
    return locate(filePath);
  });
  handle("document:save-image", (_event, documentPath, fileName, data) =>
    saveImage(documentPath, fileName, data),
  );
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
  handle("window:set-colors", (event, colors) => applyWindowColors(senderWindow(event), colors));
  handle("app:show-about", (event) => showAboutDialog(senderWindow(event)));
  handle("app:dispatch", (_event, command) => dispatchToMainWindow(command));
  handle("menu:popup", (event, menu, x, y) => popupTopMenu(senderWindow(event), menu, x, y));
  handle("window:set-document-state", (event, state) => {
    setDocumentState(state);
    setDocumentEdited(senderWindow(event), state.isDirty);
  });
  handle("window:close-confirmed", (event) => closeWithoutPrompt(senderWindow(event)));

  // When an update fails, autoUpdater emits an error event and the status is updated, so it is not rethrown to the renderer
  handle("updater:get-status", () => getUpdateStatus());
  handle("updater:check", () => checkForUpdates().catch(() => {}));
  handle("updater:download", () => downloadUpdate().catch(() => {}));
  handle("updater:install", () => installUpdate());
}
