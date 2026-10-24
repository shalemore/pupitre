import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent,
  shell,
} from "electron";
import {
  type DocumentLocation,
  type FolderEntry,
  type InvokeChannels,
  type LineEnding,
  type OpenedDocument,
  type TextEncoding,
  INITIAL_STATE_SYNC,
  type InitialState,
} from "@shared/desktop-api";
import { showAboutDialog } from "./about";
import { decodeDocument, decodeWith, encodeDocument } from "./encoding";
import { createEntry, renameEntry, trashEntry } from "./file-actions";
import { setAsDefaultMarkdownApp } from "./default-app";
import { t } from "./i18n";
import { clickMenuItem, menuSnapshot, setDocumentState } from "./menu";
import { takeLaunchFile } from "./open-files";
import { unwatchPath, watchPath } from "./path-watcher";
import { addRecentFile, getRecentFiles, removeRecentFile } from "./recent-files";
import {
  getSettings,
  getSettingsPath,
  getWorkspaceState,
  isFirstRun,
  resetSetting,
  revealWorkspaceFile,
  setWorkspace,
  updateSettings,
  useWorkspace,
} from "./settings-store";
import {
  canSelfUpdate,
  checkForUpdates,
  downloadUpdate,
  getUpdateStatus,
  installUpdate,
} from "./updater";
import {
  applyWindowColors,
  closeWithoutPrompt,
  dispatchToMainWindow,
  getMainWindow,
  getCaptionSide,
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
  const folder = dirname(path);
  return { path, folder, baseUrl: pathToFileURL(join(folder, "/")).href };
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

// One collator for every comparison: creating it per call is what makes localeCompare slow on large folders
const nameCollator = new Intl.Collator(undefined, { numeric: true });

async function listFolder(path: string): Promise<FolderEntry[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return entries
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry): FolderEntry => ({
      name: entry.name,
      path: join(path, entry.name),
      kind: entry.isDirectory() ? "directory" : "file",
    }))
    .toSorted(
      (a, b) =>
        Number(b.kind === "directory") - Number(a.kind === "directory") ||
        nameCollator.compare(a.name, b.name),
    );
}

/** Strips the BOM of a file (its encoding keeps it on save) and normalizes line endings to LF; the original line ending is restored on save. */
function normalizeText(raw: string): string {
  return raw.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n");
}

/** Null when the user gave up on the encoding of a file that is not UTF-8. */
async function readDocument(path: string, window: BrowserWindow): Promise<OpenedDocument | null> {
  try {
    const decoded = await decodeDocument(await readFile(path), path, window);
    if (decoded === undefined) return null;
    addRecentFile(path);
    return {
      ...locate(path),
      content: normalizeText(decoded.text),
      lineEnding: decoded.text.includes("\r\n") ? "crlf" : "lf",
      encoding: decoded.encoding,
    };
  } catch (error) {
    removeRecentFile(path);
    throw error;
  }
}

/** The text of a file as readDocument would give it, without touching the recent files; undefined when it is missing, not text, or larger than maxBytes. */
async function peekDocument(
  path: string,
  maxBytes: number,
  encoding: TextEncoding,
): Promise<string | undefined> {
  try {
    if ((await stat(path)).size > maxBytes) return undefined;
    return normalizeText(decodeWith(await readFile(path), encoding));
  } catch {
    return undefined;
  }
}

function writeDocument(
  path: string,
  content: string,
  lineEnding: LineEnding,
  encoding: TextEncoding,
): Promise<void> {
  const text = lineEnding === "crlf" ? content.replaceAll("\n", "\r\n") : content;
  return writeFile(path, encodeDocument(text, encoding));
}

export function registerIpcHandlers(): void {
  ipcMain.on(INITIAL_STATE_SYNC, (event) => {
    const state: InitialState = {
      settings: getSettings(),
      settingsPath: getSettingsPath(),
      firstRun: isFirstRun(),
      canSelfUpdate,
      recentFiles: getRecentFiles(),
      captionSide: getCaptionSide(event.sender),
      launchFile: event.sender === getMainWindow()?.webContents ? takeLaunchFile() : undefined,
    };
    event.returnValue = state;
  });
  handle("settings:update", (_event, patch) => updateSettings(patch));
  handle("settings:reset", (_event, key) => resetSetting(key));
  handle("settings:reveal", () => shell.showItemInFolder(getSettingsPath()));
  handle("workspace:set", (_event, root) => setWorkspace(root));
  handle("workspace:get", () => getWorkspaceState());
  handle("workspace:use", (_event, active) => useWorkspace(active));
  handle("workspace:reveal", () => revealWorkspaceFile());

  handle("document:open", async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(senderWindow(event), {
      properties: ["openFile"],
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown", "txt"] }],
    });
    const [path] = filePaths;
    if (canceled || path === undefined) return null;
    return readDocument(path, senderWindow(event));
  });
  handle("document:read", (event, path) => readDocument(path, senderWindow(event)));
  handle("folder:choose", async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(senderWindow(event), {
      properties: ["openDirectory"],
    });
    const [path] = filePaths;
    return canceled || path === undefined ? null : path;
  });
  handle("folder:list", (_event, path) => listFolder(path));
  handle("folder:create", (_event, parent, name, kind) => createEntry(parent, name, kind));
  handle("path:rename", (_event, path, name) => renameEntry(path, name));
  handle("path:trash", (_event, path) => trashEntry(path));
  handle("path:locate", (_event, path) => locate(path));
  handle("folder:watch", (event, path) => watchPath(event.sender, "folder:changed", path));
  handle("folder:unwatch", (event, path) => unwatchPath(event.sender, "folder:changed", path));
  handle("document:watch", (event, path) => watchPath(event.sender, "document:changed", path));
  handle("document:unwatch", (event, path) => unwatchPath(event.sender, "document:changed", path));
  handle("document:peek", (_event, path, maxBytes, encoding) =>
    peekDocument(path, maxBytes, encoding),
  );
  handle("document:exists", (_event, path) =>
    access(path).then(
      () => true,
      () => false,
    ),
  );
  handle("document:write", (_event, path, content, lineEnding, encoding) =>
    writeDocument(path, content, lineEnding, encoding),
  );
  handle("dialog:choose-save-path", async (event, suggestedName) => {
    const { canceled, filePath } = await dialog.showSaveDialog(senderWindow(event), {
      defaultPath: suggestedName,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (canceled || !filePath) return null;
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
  handle("dialog:confirm-external-change", async (event, fileName) => {
    const labels = t().dialogs;
    const { response } = await dialog.showMessageBox(senderWindow(event), {
      type: "warning",
      message: labels.externalChangeMessage(fileName),
      detail: labels.externalChangeDetail,
      buttons: [labels.overwrite, labels.reload, labels.keepEditing],
      defaultId: 2,
      cancelId: 2,
      noLink: true,
    });
    return response === 0 ? "overwrite" : response === 1 ? "reload" : "keep";
  });
  handle("dialog:confirm-deleted", async (event, fileName) => {
    const labels = t().dialogs;
    const { response } = await dialog.showMessageBox(senderWindow(event), {
      type: "warning",
      message: labels.fileDeletedMessage(fileName),
      detail: labels.fileDeletedDetail,
      buttons: [labels.save, labels.dontSave],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    return response === 0 ? "save" : "keep";
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
  handle("app:set-default-markdown-app", () => setAsDefaultMarkdownApp());
  handle("app:dispatch", (_event, command) => dispatchToMainWindow(command));
  handle("clipboard:write-text", (_event, text) => clipboard.writeText(text));
  handle("menu:items", () => menuSnapshot());
  handle("menu:click", (_event, itemId) => clickMenuItem(itemId));
  handle("window:set-document-state", (event, state) => {
    setDocumentState(state);
    setDocumentEdited(senderWindow(event), state.isDirty);
  });
  handle("window:close-confirmed", (event) => closeWithoutPrompt(senderWindow(event)));
  handle("window:minimize", (event) => senderWindow(event).minimize());
  handle("window:toggle-maximize", (event) => {
    const window = senderWindow(event);
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  handle("window:close", (event) => senderWindow(event).close());
  handle("window:set-buttons-visible", (event, visible) => {
    if (process.platform === "darwin") senderWindow(event).setWindowButtonVisibility(visible);
  });

  // When an update fails, autoUpdater emits an error event and the status is updated, so it is not rethrown to the renderer
  handle("updater:get-status", () => getUpdateStatus());
  handle("updater:check", () => checkForUpdates().catch(() => {}));
  handle("updater:download", () => downloadUpdate().catch(() => {}));
  handle("updater:install", () => installUpdate());
}
