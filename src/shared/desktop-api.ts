import type { FormatAction } from "./format";
import type { Menus } from "./menu";
import type { SettingKey, Settings } from "./settings";

/** The platforms the app is built for; the web demo reports the one it looks most like. */
export type DesktopPlatform = "darwin" | "win32" | "linux";

export interface DocumentLocation {
  path: string;
  /** The folder that contains the document. */
  folder: string;
  /** file:// URL of the document's folder (ending in /), used to resolve relative paths in the document. */
  baseUrl: string;
}

export const LINE_ENDINGS = ["lf", "crlf"] as const;

export type LineEnding = (typeof LINE_ENDINGS)[number];

/**
 * How a document is encoded on disk. Anything but UTF-8 comes back the same way it was read, so a
 * file written by another editor is not converted behind the user's back.
 */
export const TEXT_ENCODINGS = [
  "utf-8",
  "utf-8-bom",
  "utf-16le",
  "utf-16be",
  "gb18030",
  "big5",
  "shift_jis",
  "windows-1252",
] as const;

export type TextEncoding = (typeof TEXT_ENCODINGS)[number];

/**
 * The unsaved content of one tab, kept outside the editor so that a crash cannot take it: the whole
 * text, plus the version it was last read or saved as, so a restore can show what is still unsaved.
 */
export interface Draft {
  path?: string | undefined;
  folder?: string | undefined;
  baseUrl?: string | undefined;
  markdown: string;
  /** What the file held when the document was opened or saved; a restore compares the two. */
  savedMarkdown: string;
  lineEnding: LineEnding;
  encoding: TextEncoding;
  isSample: boolean;
}

/**
 * What a host holds for a crash: a draft per tab with unsaved changes, so every one of them comes
 * back, plus which of those tabs was being edited. A tab with nothing unsaved has no draft; the
 * startup setting decides what happens to the files then, as it always did.
 */
export interface DraftSession {
  /** Tabs in the order they were open. */
  tabs: Draft[];
  /** Index of the tab that was active in `tabs`, or 0 when it was a tab with nothing unsaved. */
  active: number;
}

export interface OpenedDocument extends DocumentLocation {
  /**
   * Content with every line ending normalized to LF; the file's original line ending is kept in
   * lineEnding and restored on save.
   */
  content: string;
  lineEnding: LineEnding;
  encoding: TextEncoding;
}

/**
 * Extensions of the text documents the editor opens, previews and links to. Separate from the file
 * types the installer claims as Pupitre's own (see fileAssociations), which are fewer.
 */
export const DOCUMENT_EXTENSIONS = ["md", "markdown", "mdown", "mkd", "mdx", "txt"] as const;

/** Those files, as a test for a path. */
export const DOCUMENT_FILE = new RegExp(`\\.(?:${DOCUMENT_EXTENSIONS.join("|")})$`, "i");

/** How much of a file a folder preview reads. */
export const PREVIEW_BYTES = 1024;

/** How a folder search compares the query with the documents. */
export interface WorkspaceSearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  /** Read the query as a regular expression rather than as literal text. */
  regexp: boolean;
}

/** One match in a document, positioned in the text the way the editor holds it: no BOM, LF line endings. */
export interface WorkspaceMatch {
  /** Offset of the first character of the match in the content of the file. */
  from: number;
  to: number;
  /** 1-based number of the line the match is on. */
  line: number;
  /** The whole line the match is on, without its line break. */
  text: string;
  /** Offset of the match in `text`, so a row can highlight it without the text of the lines above. */
  column: number;
}

/** The matches of one document of the searched folder. */
export interface WorkspaceFileMatches {
  path: string;
  /** Where the file sits in the folder, with / between the segments. */
  relative: string;
  matches: WorkspaceMatch[];
}

/** What a folder search found: a regexp the user wrote can be invalid instead, which is told apart from a search without matches. */
export type WorkspaceSearchResponse =
  | { kind: "ok"; files: WorkspaceFileMatches[] }
  | { kind: "invalid-regexp" };

export interface FolderEntry {
  name: string;
  path: string;
  kind: "directory" | "file";
}

/** A document somewhere in a folder, found by walking it whole. */
export interface FolderFile {
  path: string;
  /** Where the file sits under the folder, written with forward slashes so it reads the same everywhere. */
  relative: string;
}

/** The choice made when the file of a document with unsaved changes was modified elsewhere; "keep" continues editing without saving. */
export type ExternalChangeChoice = "overwrite" | "reload" | "keep";

/** The choice made when the file of an open document was deleted elsewhere; "keep" leaves the document open and unsaved. */
export type DeletedFileChoice = "save" | "keep";

/**
 * A version of a document a save wrote over. The text stays in the history folder until it is asked
 * for, and a document keeps only so many of them.
 */
export interface HistoryEntry {
  /** Names the snapshot within the versions of its document; the index keeps it unique. */
  id: string;
  /** When the version was overwritten, in milliseconds since the epoch. */
  savedAt: number;
  /** Size of the snapshot in bytes. */
  bytes: number;
}

/** The choice made when closing or replacing a document with unsaved changes. */
export type UnsavedChoice = "save" | "discard" | "cancel";

/** The open folder and whether its own settings are in use. */
export interface WorkspaceState {
  /** The folder whose settings can be used, or null while none is open. */
  root: string | null;
  /** Whether the folder's settings are laid over the global ones. */
  active: boolean;
  /** Whether the folder has a settings file yet; the first change made while it is active creates it. */
  exists: boolean;
  /** The settings that have a value of their own in the folder. */
  overrides: readonly SettingKey[];
}

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
  | { id: "file.open-folder" }
  | { id: "file.quick-open" }
  | { id: "file.save" }
  | { id: "file.save-as" }
  | { id: "file.close-tab" }
  | { id: "file.reopen-tab" }
  | { id: "file.print" }
  | { id: "file.version-history" }
  | { id: "view.next-tab" }
  | { id: "view.previous-tab" }
  | { id: "file.export-pdf" }
  | { id: "file.export-html" }
  | { id: "file.export-image" }
  | { id: "edit.find" }
  | { id: "edit.replace" }
  | { id: "edit.copy-html" }
  | { id: "edit.insert-image" }
  | { id: "edit.insert-table" }
  | { id: "edit.search-workspace" }
  | { id: "view.toggle-sidebar" }
  | { id: "view.command-palette" }
  | { id: "help.sample-document" }
  | { id: "format"; action: FormatAction }
  /** The document has unsaved changes before the window closes; the renderer should ask the user first. */
  | { id: "window.close" };

/** Height of the title bar every window draws at its top, which the main process also gives the native buttons. */
export const TITLE_BAR_HEIGHT = 40;

/** Window background and secondary text color under the current theme, used to avoid a flash before the window shows and to color the Windows title bar buttons. */
export interface WindowColors {
  background: string;
  symbol: string;
  dark: boolean;
}

/** What happened when the user asked to make Pupitre the default Markdown app. */
export type DefaultAppResult = "done" | "opened-settings" | "manual" | "failed";

/** Side of the window the page draws the caption buttons on (the main window on Windows and Linux); undefined when the system draws them. */
export type CaptionSide = "left" | "right";

/** How wide each sidebar of the main window is, at the start and at the end edge; the window remembers them between runs. */
export interface SidebarWidths {
  start: number;
  end: number;
}

/** Document state the renderer reports to the main process: enables or disables menu items and decides whether closing the window must ask to save first. */
export interface DocumentState {
  /** A tab holds a document, so the entries that work on one are usable. */
  hasDocument: boolean;
  /** Whether a file is behind the document on show; only a document with a path has versions to keep. */
  hasPath: boolean;
  /** Any tab has unsaved changes, so closing the window has to ask first. */
  isDirty: boolean;
  /** A tab was closed and can still come back, so File › Reopen Closed Tab is usable. */
  canReopenTab: boolean;
}

/** An image the user picked from disk, handed over as the bytes of a pasted picture would be. */
export interface PickedImage {
  /** The name of the file, which names the image where it is written and reads as its alt text. */
  name: string;
  data: Uint8Array;
}

/** Channels the renderer calls through `ipcRenderer.invoke` and the main process implements with `ipcMain.handle`. */
export interface InvokeChannels {
  "settings:update": (patch: Partial<Settings>) => void;
  /** Removes the key from the settings file so the default applies again. */
  "settings:reset": (key: SettingKey) => void;
  "settings:reveal": () => void;
  "document:open": () => OpenedDocument | null;
  /** The unsaved content left behind by a session that did not end cleanly, or null when there is none. */
  "draft:read": () => DraftSession | null;
  /** Keeps what is unsaved in the open tabs; the host writes it out shortly after. */
  "draft:write": (session: DraftSession) => void;
  /** Forgets the draft, because there is nothing unsaved left to come back to. */
  "draft:clear": () => void;
  /** Asks for a folder to show in the sidebar. */
  "folder:choose": () => string | null;
  /** Null when the user gave up on choosing the encoding of a file that is not UTF-8. */
  "document:read": (path: string) => OpenedDocument | null;
  /** Lists one level of a folder: directories first, then by name, modified or created time as the folderSort setting says; hidden entries are left out. */
  "folder:list": (path: string) => FolderEntry[];
  /**
   * Every document inside a folder and its subfolders, sorted by relative path, for finding one by
   * name. Hidden files and folders, node_modules and symbolic links stay out of it.
   */
  "folder:files": (root: string) => FolderFile[];
  /**
   * The first bytes of every Markdown file in one level of a folder, keyed by path, which is what the
   * folder shows under a file name when previews are on.
   */
  "folder:previews": (path: string) => Record<string, string>;
  /**
   * Every match of `query` in the documents under a folder, grouped by file; a folder with more
   * files or matches than a search reads reports the first ones.
   */
  "folder:search": (
    root: string,
    query: string,
    options: WorkspaceSearchOptions,
  ) => WorkspaceSearchResponse;
  /** Creates an empty file or a folder inside `parent` and returns its path. */
  "folder:create": (parent: string, name: string, kind: FolderEntry["kind"]) => string;
  /** Renames a file or folder inside its own folder and returns its new path. */
  "path:rename": (path: string, name: string) => string;
  /** Moves a file or folder to the recycle bin of the system. */
  "path:trash": (path: string) => void;
  /** Shows a file or folder in the system file manager. */
  "path:reveal": (path: string) => void;
  /** Where a path lives, so a renamed document keeps resolving its relative addresses. */
  "path:locate": (path: string) => DocumentLocation;
  /** Starts or stops telling the window, through folder:changed, when the entries of a listed folder change. */
  "folder:watch": (path: string) => void;
  "folder:unwatch": (path: string) => void;
  /** Starts or stops telling the window, through document:changed, when the file is modified. */
  "document:watch": (path: string) => void;
  "document:unwatch": (path: string) => void;
  /** The text of a file as the document with this encoding reads it, or undefined when it is missing, not text, or larger than maxBytes. */
  "document:peek": (path: string, maxBytes: number, encoding: TextEncoding) => string | undefined;
  "document:exists": (path: string) => boolean;
  "document:write": (
    path: string,
    content: string,
    lineEnding: LineEnding,
    encoding: TextEncoding,
  ) => void;
  /** Asks where to save a document; the document is written with document:write afterwards. */
  "dialog:choose-save-path": (suggestedName: string) => DocumentLocation | null;
  /** Asks for an image file; null when the user dropped out of the dialog or the file was too large to insert. */
  "image:pick": () => PickedImage | null;
  /** Saves an image into the assets folder next to the document and returns a relative path ready for Markdown. */
  "document:save-image": (documentPath: string, fileName: string, data: Uint8Array) => string;
  /**
   * Asks where to move the picture at `path`, moves it there and returns where it now sits; null
   * when the user gave up. The picture keeps its contents: this renames it, and moves it as well
   * when the chosen place is another folder.
   */
  "image:save-as": (path: string) => string | null;
  /** Moves the picture at `path` into the image folder of `folder`, the folder of its document, and returns its new path. */
  "image:move": (path: string, folder: string) => string | null;
  /** Copies the picture at `path` into a folder the user picks and returns the path of the copy; null when they gave up. */
  "image:copy": (path: string) => string | null;
  /**
   * Fetches the picture at the http(s) `url` into the image folder of `folder`, the folder of the
   * document that links it, and returns the path it was written to; null when nothing was written.
   */
  "image:download": (url: string, folder: string) => string | null;
  /** Opens the system print dialog for the window; resolves once the dialog closed, whether a page was printed or not. */
  "document:print": () => void;
  "document:export-pdf": (suggestedName: string) => string | null;
  /** Writes a page the renderer built into the file the user chose, and returns its path. */
  "document:export-html": (suggestedName: string, html: string) => string | null;
  /**
   * Renders a page as one tall PNG, twice the width of the page in device pixels, and returns the
   * file it was written to; null when the user gave up on the save dialog. The page resolves its
   * relative addresses in `baseFolder`, which is undefined while the document was never saved.
   */
  "document:export-image": (
    suggestedName: string,
    html: string,
    baseFolder: string | undefined,
  ) => string | null;
  /** The versions kept of a document, newest first, from before its file was last written. */
  "history:list": (path: string) => HistoryEntry[];
  /** The text of one kept version, or null when the document has none by that id. */
  "history:read": (path: string, id: string) => string | null;
  "dialog:confirm-unsaved": (fileName: string) => UnsavedChoice;
  /** The open file was changed on disk while the document has unsaved changes. */
  "dialog:confirm-external-change": (fileName: string) => ExternalChangeChoice;
  /** The open file was deleted on disk. */
  "dialog:confirm-deleted": (fileName: string) => DeletedFileChoice;
  "dialog:show-error": (message: string, detail: string) => void;
  "window:open-settings": () => void;
  /** Tells which folder is open, so that its settings file is found; null when none is. */
  "workspace:set": (root: string | null) => void;
  "workspace:get": () => WorkspaceState;
  /** Chooses between the open folder's settings and the global ones. */
  "workspace:use": (active: boolean) => void;
  "workspace:reveal": () => void;
  "window:set-colors": (colors: WindowColors) => void;
  /** The width the user dragged each sidebar to; the window remembers it for the next run. */
  "window:set-sidebar-widths": (widths: SidebarWidths) => void;
  "app:show-about": () => void;
  "app:set-default-markdown-app": () => DefaultAppResult;
  "app:dispatch": (command: AppCommand) => void;
  /** Puts plain text on the clipboard, for copy buttons; the renderer has no clipboard permission. */
  "clipboard:write-text": (text: string) => void;
  /**
   * Puts the same text on the clipboard in both formats, so that a rich text application keeps the
   * markup it was given and a plain one still gets the text, see features/export/document-html.ts.
   */
  "clipboard:write-rich": (text: string, html: string) => void;
  /** The entries of every top-level menu; Windows and Linux draw them in the title bar, and the contents are asked for each time a menu opens because they follow the settings, the recent files and the document. */
  "menu:items": () => Menus;
  /** Runs the menu entry the window drew; the id is the one menu:items gave that entry. */
  "menu:click": (itemId: string) => void;
  "window:set-document-state": (state: DocumentState) => void;
  /** The user has confirmed (saved or discarded changes); the window can really close. */
  "window:close-confirmed": () => void;
  "window:minimize": () => void;
  "window:toggle-maximize": () => void;
  /** Closes the window, asking about unsaved changes first. */
  "window:close": () => void;
  /** Shows or hides the macOS traffic lights together with an immersive title bar. */
  "window:set-buttons-visible": (visible: boolean) => void;
  "updater:get-status": () => UpdateStatus;
  "updater:check": () => void;
  "updater:download": () => void;
  "updater:install": () => void;
}

/** Events the main process pushes to the renderer through `webContents.send`. */
export interface RendererEvents {
  "settings:changed": Settings;
  "workspace:changed": WorkspaceState;
  /** The file of an open document was modified, possibly by the document's own save. */
  "document:changed": string;
  /** The entries of a watched folder changed. */
  "folder:changed": string;
  "recent-files:changed": readonly string[];
  "updater:status": UpdateStatus;
  "app:command": AppCommand;
  "window:maximized-changed": boolean;
}

/**
 * What a host can do besides editing text: the browser demo has no file manager, no installed
 * fonts to read, no installer to hand an update to and no way to register itself for .md files.
 */
export interface HostCapabilities {
  /** Replace the app with a downloaded installer. */
  selfUpdate: boolean;
  /** Show a file or folder in the system file manager. */
  revealFiles: boolean;
  /** Register the app as the handler of Markdown files. */
  setDefaultApp: boolean;
  /** Read the fonts installed on the system. */
  systemFonts: boolean;
  /** Set the zoom of the window; a browser zooms the page itself, with its own shortcuts. */
  zoom: boolean;
}

/** State a window needs before its first paint; fetched synchronously by the preload script. */
export interface InitialState {
  settings: Settings;
  settingsPath: string;
  /** True until a settings file exists; the welcome screen then lets the user pick a window style. */
  firstRun: boolean;
  capabilities: HostCapabilities;
  recentFiles: readonly string[];
  captionSide: CaptionSide | undefined;
  /** The sidebar widths the main window was last closed with; only the main window uses them. */
  sidebarWidths: SidebarWidths | undefined;
  /** A file the system asked to open when Pupitre started; only given to the main window. */
  launchFile: string | undefined;
}

export const INITIAL_STATE_SYNC = "app:initial-state";

export interface DesktopApi {
  readonly platform: DesktopPlatform;
  /** The Electron the window runs in; a host that is not Electron leaves it out. */
  readonly electronVersion?: string;
  invoke<K extends keyof InvokeChannels>(
    channel: K,
    ...args: Parameters<InvokeChannels[K]>
  ): Promise<ReturnType<InvokeChannels[K]>>;
  on<K extends keyof RendererEvents>(
    channel: K,
    listener: (payload: RendererEvents[K]) => void,
  ): () => void;
  readonly initialState: InitialState;
  getPathForFile(file: File): string;
}
