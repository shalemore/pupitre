import { mkdir, open, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  BrowserWindow,
  ClipboardItem,
  clipboard,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent,
  type FileFilter,
  type OpenDialogOptions,
  shell,
  type WebContents,
} from "electron";
import log from "electron-log/main";
import {
  type DeletedFileChoice,
  type DocumentLocation,
  type ExternalChangeChoice,
  type FolderEntry,
  type InvokeChannels,
  type LineEnding,
  type OpenedDocument,
  type TextEncoding,
  type UnsavedChoice,
  INITIAL_STATE_SYNC,
  type InitialState,
  DOCUMENT_EXTENSIONS,
  DOCUMENT_FILE,
  PREVIEW_BYTES,
} from "@shared/desktop-api";
import { formatFileSize } from "@shared/file-size";
import { compareFolderEntries, UNTIMED } from "@shared/folder-sort";
import { intlLocale } from "@shared/i18n";
import type { Settings } from "@shared/settings";
import { showAboutDialog } from "./about";
import { setAsDefaultMarkdownApp } from "./default-app";
import { choose, type Answer } from "./dialog-choice";
import { clearDraft, readDraft, writeDraft } from "./drafts";
import {
  decodeDocument,
  decodeWith,
  declaredEncoding,
  encodeDocument,
  lineEndingOf,
  normalizeText,
  withLineEnding,
} from "./encoding";
import { exists } from "./exists";
import { exportImage } from "./export-image";
import {
  MAX_IMAGE_BYTES,
  copyImageInto,
  createEntry,
  downloadImage,
  moveImage,
  moveImageInto,
  renameEntry,
  trashEntry,
} from "./file-actions";
import { listVersions, MAX_SNAPSHOT_BYTES, readVersion, recordVersion } from "./history";
import { currentLocale, t } from "./i18n";
import { clickMenuItem, menuSnapshot, setDocumentState } from "./menu";
import { takeLaunchFile } from "./open-files";
import { unwatchPath, watchPath } from "./path-watcher";
import { pdfPrintOptions } from "./pdf-print-options";
import { readPins, writePins } from "./pins";
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
import { getImportedThemes, revealThemeFolder, setProjectThemeRoot } from "./themes";
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

/** Asks about a document in a native box whose buttons are the answers, and gives back the one that was pressed. */
async function confirmChoice<T>(
  window: BrowserWindow,
  question: { message: string; detail: string },
  answers: readonly [Answer<T>, ...Answer<T>[]],
  defaultIndex = 0,
): Promise<T> {
  const chosen = await choose(
    window,
    {
      type: "warning",
      message: question.message,
      detail: question.detail,
      defaultId: defaultIndex,
    },
    answers,
  );
  const [firstAnswer, ...otherAnswers] = answers;
  return chosen ?? otherAnswers.at(-1)?.value ?? firstAnswer.value;
}

/** The file or folder the user picked, or null when they dropped out of the dialog. */
async function openPath(window: BrowserWindow, options: OpenDialogOptions): Promise<string | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog(window, options);
  const [path] = filePaths;
  return canceled || path === undefined ? null : path;
}

/** Where the user wants a file of this kind written, or null when they dropped out of the dialog. */
async function savePath(
  window: BrowserWindow,
  defaultPath: string,
  filter: FileFilter,
): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog(window, {
    defaultPath,
    filters: [filter],
  });
  return canceled || filePath === "" ? null : filePath;
}

function locate(path: string): DocumentLocation {
  // One spelling per file: the same document can be opened by a path with either separator, and
  // the windows, the sidebar and the remembered places have to agree on which file they mean
  const resolved = resolve(path);
  const folder = dirname(resolved);
  return { path: resolved, folder, baseUrl: pathToFileURL(join(folder, "/")).href };
}

/**
 * The kind of path the window can hand to a file action. A path a picture is linked with comes from
 * the document, so one that is not absolute would point outside the folder the user opened.
 */
function checkedPath(path: string): string {
  if (!isAbsolute(path)) throw new Error(`${path} is not an absolute path`);
  return path;
}

/** The pictures the Insert Image dialog offers, and how large one may be: a document links its images rather than embedding them. */
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];

/** Where the pictures of a document go: the image folder the settings name, beside the document. */
function imageFolder(folder: string): string {
  return join(folder, getSettings().imageFolder);
}

async function saveImage(
  documentPath: string,
  fileName: string,
  data: Uint8Array,
): Promise<string> {
  const folder = getSettings().imageFolder;
  const directory = imageFolder(dirname(documentPath));
  await mkdir(directory, { recursive: true });
  // Pasted screenshots are usually all named image.png; a timestamp keeps them from overwriting existing images
  const extension = extname(fileName) || ".png";
  const stem = basename(fileName, extension).replace(/[^\p{L}\p{N}._-]+/gu, "-");
  const name = `${stem}-${Date.now()}${extension}`;
  await writeFile(join(directory, name), data, { flag: "wx" });
  // Paths in Markdown use / and each segment is encoded for spaces and other special characters
  return [...folder.split(/[\\/]+/), name].map(encodeURIComponent).join("/");
}

/** How the folder sidebar orders the entries of one folder. */
type FolderSort = Settings["folderSort"];

/** The entries of one level of a folder, hidden ones left out, in no order. */
async function readFolder(path: string): Promise<FolderEntry[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return entries
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry): FolderEntry => ({
      name: entry.name,
      path: join(path, entry.name),
      kind: entry.isDirectory() ? "directory" : "file",
    }));
}

/** When an entry was modified or created, or undefined when the system would not say. */
async function entryTime(
  path: string,
  sort: Exclude<FolderSort, "name">,
): Promise<number | undefined> {
  try {
    const stats = await stat(path);
    return sort === "modified" ? stats.mtimeMs : stats.birthtimeMs;
  } catch {
    // A file that vanished since it was listed, or one the user may not read, still has a row
    return undefined;
  }
}

/**
 * One level of a folder: directories first, then the order the folderSort setting asks for. The
 * times cost one call per entry, so only the orders that read them pay for it.
 */
async function listFolder(path: string): Promise<FolderEntry[]> {
  const entries = await readFolder(path);
  const sort = getSettings().folderSort;
  const times =
    sort === "name"
      ? undefined
      : await Promise.all(entries.map((entry) => entryTime(entry.path, sort)));
  return entries
    .map((entry, index) => ({ entry, time: times?.[index] ?? UNTIMED }))
    .toSorted(compareFolderEntries)
    .map(({ entry }) => entry);
}

/** Windows whose page layout has been warmed up, see the export handler. */
const printWarmedUp = new WeakSet<WebContents>();

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
  const files = (await readFolder(path)).filter(
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
    const lineEnding = lineEndingOf(decoded.text);
    return {
      ...locate(path),
      content: normalizeText(decoded.text, lineEnding),
      lineEnding,
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
  return writeFile(path, encodeDocument(withLineEnding(content, lineEnding), encoding));
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
    if ((await stat(path)).size > MAX_SNAPSHOT_BYTES) return;
    // Read the way the document reads it, so a version of a file in another encoding is kept as
    // the text the editor showed rather than as its bytes
    previous = normalizeText(decodeWith(await readFile(path), encoding));
  } catch (error) {
    // A file that does not exist yet is a first save, which has nothing to keep; anything else is
    // worth a line in the log, but not worth failing the save over
    if (error instanceof Error && "code" in error && error.code !== "ENOENT") {
      log.error(`Could not read ${path} to keep its previous version:`, error);
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
        folderParent: true,
      },
      recentFiles: getRecentFiles(),
      captionSide: getCaptionSide(event.sender),
      sidebarWidths: readWindowState()?.sidebar,
      launchFile: event.sender === getMainWindow()?.webContents ? takeLaunchFile() : undefined,
      themes: getImportedThemes(),
    };
    event.returnValue = state;
  });
  handle("settings:update", (_event, patch) => updateSettings(patch));
  handle("settings:reset", (_event, key) => resetSetting(key));
  handle("settings:reveal", () => shell.showItemInFolder(getSettingsPath()));
  handle("themes:list", () => getImportedThemes());
  handle("themes:reveal", (_event, source) => void revealThemeFolder(source));
  handle("workspace:set", (_event, root) => {
    setWorkspace(root);
    setProjectThemeRoot(root);
  });
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
  handle("folder:pins", (_event, root) => readPins(root));
  handle("folder:set-pins", (_event, root, paths) => writePins(root, paths));
  handle("folder:files", (_event, root) => listWorkspaceFiles(root));
  handle("folder:previews", (_event, path) => folderPreviews(path));
  handle("folder:search", (_event, root, query, options) => searchWorkspace(root, query, options));
  handle("folder:create", (_event, parent, name, kind) => createEntry(parent, name, kind));
  handle("path:rename", (_event, path, name) => renameEntry(path, name));
  handle("path:trash", (_event, path) => trashEntry(path));
  handle("path:reveal", (_event, path) => shell.showItemInFolder(path));
  handle("path:locate", (_event, path) => locate(path));
  handle("folder:watch", (event, path) => watchPath(event.sender, "folder:changed", path));
  handle("folder:unwatch", (event, path) => unwatchPath(event.sender, "folder:changed", path));
  handle("document:watch", (event, path) => watchPath(event.sender, "document:changed", path));
  handle("document:unwatch", (event, path) => unwatchPath(event.sender, "document:changed", path));
  handle("document:peek", (_event, path, maxBytes, encoding) =>
    peekDocument(path, maxBytes, encoding),
  );
  handle("document:exists", (_event, path) => exists(path));
  handle("document:write", async (_event, path, content, lineEnding, encoding) => {
    await keepPreviousVersion(path, content, encoding);
    await writeDocument(path, content, lineEnding, encoding);
  });
  handle("history:list", (_event, path) => listVersions(path));
  handle("history:read", (_event, path, id) => readVersion(path, id));
  handle("dialog:choose-save-path", async (event, suggestedName) => {
    const path = await savePath(senderWindow(event), suggestedName, {
      name: "Markdown",
      extensions: ["md"],
    });
    if (path === null) return null;
    addRecentFile(path);
    return locate(path);
  });
  handle("image:pick", async (event) => {
    const window = senderWindow(event);
    const path = await openPath(window, {
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
    });
    if (path === null) return null;
    const name = basename(path);
    if ((await stat(path)).size > MAX_IMAGE_BYTES) {
      await dialog.showMessageBox(window, {
        type: "error",
        message: t().dialogs.imageTooLarge(name),
        detail: t().dialogs.imageTooLargeDetail(
          formatFileSize(MAX_IMAGE_BYTES, intlLocale(currentLocale())),
        ),
        noLink: true,
      });
      return null;
    }
    return { name, data: new Uint8Array(await readFile(path)) };
  });
  handle("document:save-image", (_event, documentPath, fileName, data) =>
    saveImage(documentPath, fileName, data),
  );
  // The window names the picture it shows, and the main process checks that path before it touches
  // anything; where a picture goes is either a place the user picks or the image folder of the
  // document
  handle("image:save-as", async (event, path) => {
    const source = checkedPath(path);
    const target = await savePath(senderWindow(event), source, {
      name: "Image",
      extensions: IMAGE_EXTENSIONS,
    });
    return target === null ? null : moveImage(source, target);
  });
  handle("image:move", (_event, path, folder) =>
    moveImageInto(checkedPath(path), imageFolder(checkedPath(folder))),
  );
  handle("image:copy", async (event, path) => {
    const source = checkedPath(path);
    const folder = await openPath(senderWindow(event), { properties: ["openDirectory"] });
    return folder === null ? null : copyImageInto(source, folder);
  });
  handle("image:download", (_event, url, folder) =>
    downloadImage(url, imageFolder(checkedPath(folder))),
  );
  // Printing goes through the system dialog, which also lets the user cancel; the callback reports
  // that cancel as a failure beside real failures, so its result is not worth handing to the window
  handle("document:print", async (event) => {
    await new Promise<void>((done) => event.sender.print({ printBackground: true }, () => done()));
  });

  handle("document:export-pdf", async (event, suggestedName) => {
    const filePath = await savePath(senderWindow(event), suggestedName, {
      name: "PDF",
      extensions: ["pdf"],
    });
    if (filePath === null) return null;
    const options = pdfPrintOptions(getSettings());
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
    const filePath = await savePath(senderWindow(event), suggestedName, {
      name: "HTML",
      extensions: ["html"],
    });
    if (filePath === null) return null;
    // A page carries its own charset, so it is written as UTF-8 whatever the document was
    await writeFile(filePath, html, "utf8");
    return filePath;
  });

  handle("document:export-image", async (event, suggestedName, html, baseFolder) => {
    const filePath = await savePath(senderWindow(event), suggestedName, {
      name: "PNG",
      extensions: ["png"],
    });
    if (filePath === null) return null;
    await exportImage({ html, filePath, baseFolder });
    return filePath;
  });

  handle("dialog:confirm-unsaved", (event, fileName) => {
    const labels = t().dialogs;
    return confirmChoice<UnsavedChoice>(
      senderWindow(event),
      { message: labels.unsavedMessage(fileName), detail: labels.unsavedDetail },
      [
        { label: labels.save, value: "save" },
        { label: labels.dontSave, value: "discard" },
        { label: labels.cancel, value: "cancel" },
      ],
    );
  });
  handle("dialog:confirm-external-change", (event, fileName) => {
    const labels = t().dialogs;
    return confirmChoice<ExternalChangeChoice>(
      senderWindow(event),
      { message: labels.externalChangeMessage(fileName), detail: labels.externalChangeDetail },
      [
        { label: labels.overwrite, value: "overwrite" },
        { label: labels.reload, value: "reload" },
        { label: labels.keepEditing, value: "keep" },
      ],
      // Keep Editing touches nothing, so it is the answer a stray Return picks
      2,
    );
  });
  handle("dialog:confirm-deleted", (event, fileName) => {
    const labels = t().dialogs;
    return confirmChoice<DeletedFileChoice>(
      senderWindow(event),
      { message: labels.fileDeletedMessage(fileName), detail: labels.fileDeletedDetail },
      [
        { label: labels.save, value: "save" },
        { label: labels.dontSave, value: "keep" },
      ],
    );
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
  handle("clipboard:read-text", () => clipboard.readText());
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
