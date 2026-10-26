import { access, mkdir, open, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  BrowserWindow,
  ClipboardItem,
  clipboard,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent,
  type OpenDialogOptions,
  type SaveDialogOptions,
  shell,
  type WebContents,
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
  DOCUMENT_EXTENSIONS,
  DOCUMENT_FILE,
  PREVIEW_BYTES,
} from "@shared/desktop-api";
import { showAboutDialog } from "./about";
import { setAsDefaultMarkdownApp } from "./default-app";
import { clearDraft, readDraft, writeDraft } from "./drafts";
import {
  decodeDocument,
  decodeWith,
  declaredEncoding,
  encodeDocument,
  normalizeText,
} from "./encoding";
import { exportImage } from "./export-image";
import { createEntry, renameEntry, trashEntry } from "./file-actions";
import { listVersions, readVersion, recordVersion } from "./history";
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
import { readWindowState, updateWindowState } from "./window-state";
import {
  applyWindowColors,
  closeWithoutPrompt,
  dispatchToMainWindow,
  getMainWindow,
  getCaptionSide,
  setDocumentEdited,
  showSettingsWindow,
} from "./windows";
import { listWorkspaceFiles } from "./workspace-files";
import { searchWorkspace } from "./workspace-search";

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

/** The file or folder the user picked, or null when they dropped out of the dialog. */
async function openPath(window: BrowserWindow, options: OpenDialogOptions): Promise<string | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog(window, options);
  const [path] = filePaths;
  return canceled || path === undefined ? null : path;
}

/** Where the user wants a file written, or null when they dropped out of the dialog. */
async function savePath(window: BrowserWindow, options: SaveDialogOptions): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog(window, options);
  return canceled || filePath === "" ? null : filePath;
}

function locate(path: string): DocumentLocation {
  // One spelling per file: the same document can be opened by a path with either separator, and
  // the windows, the sidebar and the remembered places have to agree on which file they mean
  const resolved = resolve(path);
  const folder = dirname(resolved);
  return { path: resolved, folder, baseUrl: pathToFileURL(join(folder, "/")).href };
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

/** Windows whose page layout has been warmed up, see the export handler. */
const printWarmedUp = new WeakSet<WebContents>();

/**
 * The foot of a page of an exported PDF: the page number, in the width of the text so that it
 * lines up with it. Chromium fills in the `pageNumber` and `totalPages` classes.
 */
const PAGE_NUMBER_FOOTER = `
  <div style="width: 100%; margin: 0 18mm; font: 9px/1 sans-serif; color: #8a8a8a; text-align: center;">
    <span class="pageNumber"></span> / <span class="totalPages"></span>
  </div>`;

/** The first bytes of a file as text; undefined when it cannot be read. */
async function readHead(path: string): Promise<string | undefined> {
  try {
    const file = await open(path, "r");
    try {
      const buffer = Buffer.alloc(PREVIEW_BYTES);
      const { bytesRead } = await file.read(buffer, 0, PREVIEW_BYTES, 0);
      const head = buffer.subarray(0, bytesRead);
      return decodeWith(head, declaredEncoding(head) ?? "utf-8");
    } finally {
      await file.close();
    }
  } catch {
    return undefined;
  }
}

async function folderPreviews(path: string): Promise<Record<string, string>> {
  const files = (await listFolder(path)).filter(
    (entry) => entry.kind === "file" && DOCUMENT_FILE.test(entry.name),
  );
  const heads = await Promise.all(
    files.map(async (file) => [file.path, await readHead(file.path)] as const),
  );
  return Object.fromEntries(
    heads.filter((head): head is [string, string] => head[1] !== undefined),
  );
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

/**
 * Keeps what the file holds before a save writes over it. This is the one place a document reaches
 * its file, so every save — first, auto or Save As — leaves the version it replaced behind.
 */
async function keepPreviousVersion(
  path: string,
  content: string,
  encoding: TextEncoding,
): Promise<void> {
  let previous: string;
  try {
    // Read the way the document reads it, so a version of a file in another encoding is kept as
    // the text the editor showed rather than as its bytes
    previous = normalizeText(decodeWith(await readFile(path), encoding));
  } catch (error) {
    // A file that does not exist yet is a first save, which has nothing to keep; anything else is
    // worth a line in the log, but not worth failing the save over
    if (error instanceof Error && "code" in error && error.code !== "ENOENT") {
      console.error(`Could not read ${path} to keep its previous version:`, error);
    }
    return;
  }
  if (previous === content) return;
  await recordVersion(path, previous);
}

export function registerIpcHandlers(): void {
  ipcMain.on(INITIAL_STATE_SYNC, (event) => {
    const state: InitialState = {
      settings: getSettings(),
      settingsPath: getSettingsPath(),
      firstRun: isFirstRun(),
      capabilities: {
        selfUpdate: canSelfUpdate,
        revealFiles: true,
        setDefaultApp: true,
        systemFonts: true,
        zoom: true,
      },
      recentFiles: getRecentFiles(),
      captionSide: getCaptionSide(event.sender),
      sidebarWidths: readWindowState()?.sidebar,
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
    const path = await openPath(senderWindow(event), {
      properties: ["openFile"],
      filters: [{ name: "Markdown", extensions: [...DOCUMENT_EXTENSIONS] }],
    });
    return path === null ? null : readDocument(path, senderWindow(event));
  });
  handle("document:read", (event, path) => readDocument(path, senderWindow(event)));
  handle("draft:read", () => readDraft());
  handle("draft:write", (_event, draft) => writeDraft(draft));
  handle("draft:clear", () => clearDraft());
  handle("folder:choose", (event) =>
    openPath(senderWindow(event), { properties: ["openDirectory"] }),
  );
  handle("folder:list", (_event, path) => listFolder(path));
  handle("folder:files", (_event, root) => listWorkspaceFiles(root));
  handle("folder:previews", (_event, path) => folderPreviews(path));
  handle("folder:search", (_event, root, query, options) => searchWorkspace(root, query, options));
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
  handle("document:write", async (_event, path, content, lineEnding, encoding) => {
    await keepPreviousVersion(path, content, encoding);
    await writeDocument(path, content, lineEnding, encoding);
  });
  handle("history:list", (_event, path) => listVersions(path));
  handle("history:read", (_event, path, id) => readVersion(path, id));
  handle("dialog:choose-save-path", async (event, suggestedName) => {
    const path = await savePath(senderWindow(event), {
      defaultPath: suggestedName,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (path === null) return null;
    addRecentFile(path);
    return locate(path);
  });
  handle("document:save-image", (_event, documentPath, fileName, data) =>
    saveImage(documentPath, fileName, data),
  );
  // Printing goes through the system dialog, which also lets the user cancel; the callback reports
  // that cancel as a failure beside real failures, so its result is not worth handing to the window
  handle("document:print", async (event) => {
    await new Promise<void>((done) => event.sender.print({ printBackground: true }, () => done()));
  });

  handle("document:export-pdf", async (event, suggestedName) => {
    const filePath = await savePath(senderWindow(event), {
      defaultPath: suggestedName,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (filePath === null) return null;
    const pageNumbers = getSettings().pdfPageNumbers;
    const options: Electron.PrintToPDFOptions = {
      printBackground: true,
      // The stylesheet decides the sheet the document is printed on, so a theme can change it
      preferCSSPageSize: true,
      pageSize: "A4",
      // Chromium draws the foot of every page in the page's margin and fills in the two classes
      displayHeaderFooter: pageNumbers,
      headerTemplate: "<div></div>",
      footerTemplate: PAGE_NUMBER_FOOTER,
    };
    // The first page layout of a window renders the lines it showed and no others, which leaves a
    // page carrying nothing but its number at the end; one thrown-away page settles that layout,
    // and the next one is laid out whole
    if (!printWarmedUp.has(event.sender)) {
      await event.sender.printToPDF({ ...options, pageRanges: "1" });
      printWarmedUp.add(event.sender);
    }
    const pdf = await event.sender.printToPDF(options);
    await writeFile(filePath, pdf);
    return filePath;
  });

  handle("document:export-html", async (event, suggestedName, html) => {
    const filePath = await savePath(senderWindow(event), {
      defaultPath: suggestedName,
      filters: [{ name: "HTML", extensions: ["html"] }],
    });
    if (filePath === null) return null;
    // A page carries its own charset, so it is written as UTF-8 whatever the document was
    await writeFile(filePath, html, "utf8");
    return filePath;
  });

  handle("document:export-image", async (event, suggestedName, html, baseFolder) => {
    const filePath = await savePath(senderWindow(event), {
      defaultPath: suggestedName,
      filters: [{ name: "PNG", extensions: ["png"] }],
    });
    if (filePath === null) return null;
    await exportImage({ html, filePath, baseFolder });
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
  handle("window:set-sidebar-widths", (_event, widths) => updateWindowState({ sidebar: widths }));
  handle("app:show-about", (event) => showAboutDialog(senderWindow(event)));
  handle("app:set-default-markdown-app", () => setAsDefaultMarkdownApp());
  handle("app:dispatch", (_event, command) => dispatchToMainWindow(command));
  handle("clipboard:write-text", (_event, text) => clipboard.writeText(text));
  // Both formats go into one entry, so that a rich text application and a plain one each read
  // what they understand from the same copy
  handle("clipboard:write-rich", async (_event, text, html) => {
    await clipboard.write([new ClipboardItem({ "text/plain": text, "text/html": html })]);
  });
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
