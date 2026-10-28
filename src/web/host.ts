import {
  DOCUMENT_EXTENSIONS,
  DOCUMENT_FILE,
  PREVIEW_BYTES,
  type AppCommand,
  type DesktopApi,
  type DesktopPlatform,
  type DocumentState,
  type DraftSession,
  type FolderEntry,
  type InvokeChannels,
  type OpenedDocument,
  type PinnedEntry,
  type RendererEvents,
  type UnsavedChoice,
} from "@shared/desktop-api";
import { readDraftSession } from "@shared/draft";
import {
  FORMAT_ACTIONS,
  INLINE_FORMAT_ACTIONS,
  PARAGRAPH_MENU_GROUPS,
  type FormatAction,
} from "@shared/format";
import { getDictionary, resolveLocale } from "@shared/i18n";
import {
  formatShortcut,
  type MenuEntry,
  type Menus,
  menusOf,
  type TopMenu,
  withGroupSeparators,
} from "@shared/menu";
import { pinKeyOf } from "@shared/pins";
import {
  DEFAULT_SETTINGS,
  patchSettingsFile,
  resolveSettings,
  type SettingKey,
  type Settings,
  settingsFileSchema,
  withoutSetting,
} from "@shared/settings";
import about from "./demo/about.md?raw";

/**
 * The window.desktop of the demo in a browser: what the desktop app gets from its main process,
 * kept in the page. Settings live in localStorage, the files are a few in memory, and what a
 * browser cannot do (updates, folder settings, window controls) does nothing.
 */

const SETTINGS_KEY = "pupitre:settings";
const DRAFT_KEY = "pupitre:draft";
/** A browser is closest to Linux: shortcuts are written with Ctrl and windows have no system menu bar. */
const platform: DesktopPlatform = "linux";
const DEMO_FOLDER = "/demo";
// The demo has no bundle to keep small across launches, so its sample document is part of the page
const SAMPLE_DOCUMENTS = import.meta.glob<string>("../renderer/features/samples/documents/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});
const isSettingsWindow = location.hash === "#settings";
const siteUrl = new URL("./", location.href).href;

// Settings, kept the way the desktop app keeps them: only what differs from the defaults
function readSettingsFile(): Record<string, unknown> {
  try {
    return settingsFileSchema.parse(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}"));
  } catch {
    return {};
  }
}
const firstRun = localStorage.getItem(SETTINGS_KEY) === null;
// The immersive window is what the demo is about, so it starts there until the visitor chooses
let settingsFile: Record<string, unknown> = firstRun
  ? { windowStyle: "immersive" }
  : readSettingsFile();
let settings: Settings = resolveSettings(settingsFile);

const events = new EventTarget();
function emit<K extends keyof RendererEvents>(channel: K, payload: RendererEvents[K]): void {
  events.dispatchEvent(new CustomEvent(channel, { detail: payload }));
}

// The desktop app makes the system theme follow the Color Scheme setting, and the stylesheets follow
// the system through prefers-color-scheme. A page cannot change that, so the queries in its
// stylesheets are switched to match the setting instead.
const originalQueries = new WeakMap<CSSMediaRule, string>();
function followColorScheme(): void {
  const visit = (rules: CSSRuleList): void => {
    for (const rule of rules) {
      if (rule instanceof CSSMediaRule) {
        const original = originalQueries.get(rule) ?? rule.media.mediaText;
        originalQueries.set(rule, original);
        const scheme = /prefers-color-scheme:\s*(dark|light)/.exec(original)?.[1];
        if (scheme !== undefined) {
          const matches = (scheme === "dark") === (settings.colorScheme === "dark");
          rule.media.mediaText =
            settings.colorScheme === "system" ? original : matches ? "all" : "not all";
        }
      }
      if (rule instanceof CSSGroupingRule) visit(rule.cssRules);
    }
  };
  for (const sheet of document.styleSheets) visit(sheet.cssRules);
}
// Themes and libraries add stylesheets while the page runs
new MutationObserver(followColorScheme).observe(document.head, {
  childList: true,
  subtree: true,
  characterData: true,
});
window.addEventListener("load", followColorScheme);

function publishSettings(): void {
  settings = resolveSettings(settingsFile);
  followColorScheme();
  emit("settings:changed", settings);
}

function saveSettings(): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsFile));
  publishSettings();
}

function updateSettings(patch: Partial<Settings>): void {
  settingsFile = patchSettingsFile(settingsFile, patch, DEFAULT_SETTINGS);
  saveSettings();
}

function resetSetting(key: SettingKey): void {
  settingsFile = withoutSetting(settingsFile, key);
  saveSettings();
}

// The preferences open in a window of their own, which shares the settings through localStorage
window.addEventListener("storage", (event) => {
  if (event.key !== SETTINGS_KEY) return;
  settingsFile = readSettingsFile();
  publishSettings();
});
// The preferences window has nothing to ask of the page it was opened from
function dispatch(command: AppCommand): void {
  if (!isSettingsWindow) emit("app:command", command);
}

// The unsaved documents, kept where the desktop app keeps them in userData; a page that reloads or
// closes by accident finds them the same way
function readDraft(): DraftSession | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
    const draft = readDraftSession(stored);
    if (draft !== null) return draft;
  } catch {
    // A draft that is not JSON at all falls through to the same answer
  }
  localStorage.removeItem(DRAFT_KEY);
  return null;
}

function writeDraft(session: DraftSession): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(session));
  } catch {
    // Full or unavailable storage only costs the draft; the documents themselves are in the page
  }
}

// Files: a small folder in memory
// The language follows the setting, so it is read when it is needed
const currentLocale = () => resolveLocale(settings.locale, navigator.languages);
const labels = () => getDictionary(currentLocale());
const ABOUT_PATH = `${DEMO_FOLDER}/About this demo.md`;
const files = new Map([
  [ABOUT_PATH, about],
  [
    `${DEMO_FOLDER}/Pupitre Guide.md`,
    SAMPLE_DOCUMENTS[`../renderer/features/samples/documents/${currentLocale()}.md`] ?? "",
  ],
]);
// Files dropped on the page are read after the page asked for their path
const dropped = new Map<string, Promise<string>>();
// Pinned entries live in the page as well; the demo folder has no settings file to keep them in
const folderPins = new Map<string, PinnedEntry[]>();

/** When the demo files were made and last written, for the folder orders that read times. */
interface DemoTimes {
  readonly created: number;
  readonly modified: number;
}
const fileTimes = new Map<string, DemoTimes>();
const demoStarted = Date.now();
for (const path of files.keys()) {
  fileTimes.set(path, { created: demoStarted, modified: demoStarted });
}

function touchFile(path: string, created = false): void {
  const previous = fileTimes.get(path);
  const now = Date.now();
  fileTimes.set(path, {
    created: created || previous === undefined ? now : previous.created,
    modified: now,
  });
}

function opened(path: string): OpenedDocument {
  const folder = path.slice(0, path.lastIndexOf("/"));
  return {
    path,
    folder,
    baseUrl: siteUrl,
    // The editor works on LF; the desktop host normalizes a file the same way before handing it over
    content: (files.get(path) ?? "").replaceAll(/\r\n?/g, "\n"),
    lineEnding: "lf",
    // A browser hands over text that is already decoded, so the demo writes UTF-8
    encoding: "utf-8",
  };
}

function listFolder(path: string): FolderEntry[] {
  const entries = new Map<string, FolderEntry>();
  for (const file of files.keys()) {
    if (!file.startsWith(`${path}/`)) continue;
    const [name = "", ...rest] = file.slice(path.length + 1).split("/");
    entries.set(name, {
      name,
      path: `${path}/${name}`,
      kind: rest.length > 0 ? "directory" : "file",
    });
  }
  const sort = settings.folderSort;
  return [...entries.values()].toSorted((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    if (sort !== "name") {
      const difference = timeOf(b, sort) - timeOf(a, sort);
      if (difference !== 0) return difference;
    }
    return a.name.localeCompare(b.name);
  });
}

/** The time the demo last wrote an entry, or its newest child for a folder. */
function timeOf(entry: FolderEntry, sort: Exclude<Settings["folderSort"], "name">): number {
  if (entry.kind === "file") return fileTimes.get(entry.path)?.[sort] ?? 0;
  let newest = 0;
  for (const [path, times] of fileTimes) {
    if (path.startsWith(`${entry.path}/`)) newest = Math.max(newest, times[sort]);
  }
  return newest;
}

function folderPreviews(path: string): Record<string, string> {
  const previews: Record<string, string> = {};
  for (const [file, text] of files) {
    const name = file.slice(path.length + 1);
    if (!file.startsWith(`${path}/`) || name.includes("/") || !DOCUMENT_FILE.test(name)) continue;
    previews[file] = text.slice(0, PREVIEW_BYTES);
  }
  return previews;
}

function pickFile(): Promise<OpenedDocument | null> {
  const { promise, resolve } = Promise.withResolvers<OpenedDocument | null>();
  const input = document.createElement("input");
  input.type = "file";
  input.accept = DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(",");
  input.addEventListener("cancel", () => resolve(null));
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return resolve(null);
    const path = `${DEMO_FOLDER}/${file.name}`;
    files.set(path, await file.text());
    resolve(opened(path));
  });
  input.click();
  return promise;
}

// Menus: the window draws the menu bar itself, so the demo describes its entries the way the app's
// main process does and keeps what each of them runs
type DemoMenuEntry =
  | "separator"
  | {
      label: string;
      /** An Electron accelerator; it is written the way the platform shows it. */
      shortcut?: string;
      enabled?: boolean;
      checked?: boolean;
      run?: () => void;
      submenu?: readonly DemoMenuEntry[];
    };

const divider: DemoMenuEntry = "separator";
// The drawn menu reports the id of the entry that was picked; only one menu is open at a time
let menuRuns = new Map<string, () => void>();

function menuItems(menu: TopMenu): DemoMenuEntry[] {
  const { menu: m, format } = labels();
  const { hasDocument, hasPath, canReopenTab } = documentState;
  // A document without a file has no versions kept of it
  const hasFile = hasDocument && hasPath;
  const send = (command: AppCommand) => () => dispatch(command);
  const formatItems = (actions: readonly FormatAction[]): DemoMenuEntry[] =>
    actions.map((action) => {
      const shortcut = FORMAT_ACTIONS.find(({ id }) => id === action)?.shortcut;
      return {
        label: format[action],
        run: send({ id: "format", action }),
        ...(shortcut === undefined ? {} : { shortcut }),
      };
    });
  switch (menu) {
    case "file":
      return [
        { label: m.newFile, run: send({ id: "file.new" }) },
        { label: m.openFile, run: send({ id: "file.open" }) },
        // No entry for opening a folder: the demo has one folder and it is open already
        {
          label: m.quickOpen,
          shortcut: "CmdOrCtrl+P",
          run: send({ id: "file.quick-open" }),
        },
        divider,
        { label: m.save, enabled: hasDocument, run: send({ id: "file.save" }) },
        { label: m.saveAs, enabled: hasDocument, run: send({ id: "file.save-as" }) },
        { label: m.print, enabled: hasDocument, run: send({ id: "file.print" }) },
        { label: m.exportPdf, enabled: hasDocument, run: send({ id: "file.export-pdf" }) },
        { label: m.exportHtml, enabled: hasDocument, run: send({ id: "file.export-html" }) },
        { label: m.exportImage, enabled: hasDocument, run: send({ id: "file.export-image" }) },
        divider,
        // The demo folder lives in memory, so nothing is kept of what a save writes over; the
        // panel still opens, and tells that no version was kept
        { label: m.versionHistory, enabled: hasFile, run: send({ id: "file.version-history" }) },
        divider,
        {
          label: m.closeTab,
          shortcut: "CmdOrCtrl+W",
          enabled: hasDocument,
          run: send({ id: "file.close-tab" }),
        },
        {
          label: m.reopenTab,
          shortcut: "CmdOrCtrl+Shift+T",
          // Only a tab that was closed can come back, and closing one is the only thing that changes that
          enabled: canReopenTab,
          run: send({ id: "file.reopen-tab" }),
        },
        { label: m.preferences, run: () => void handlers["window:open-settings"]() },
      ];
    case "edit":
      return [
        // Ctrl+C stays the browser's own, so the demo draws only the copy the renderer builds
        {
          label: m.copyHtml,
          shortcut: "CmdOrCtrl+Shift+C",
          run: send({ id: "edit.copy-html" }),
        },
        divider,
        { label: m.find, run: send({ id: "edit.find" }) },
        { label: m.replace, run: send({ id: "edit.replace" }) },
        // The demo folder is searched like any other, but it is read in the page, so the search
        // finds nothing rather than reaching for the file system
        {
          label: m.searchInFolder,
          shortcut: "CmdOrCtrl+Shift+F",
          run: send({ id: "edit.search-workspace" }),
        },
      ];
    case "paragraphMenu":
      return [
        ...withGroupSeparators(PARAGRAPH_MENU_GROUPS.map(formatItems), divider),
        divider,
        { label: m.insertTable, run: send({ id: "edit.insert-table" }) },
      ];
    case "format":
      return [
        ...formatItems(INLINE_FORMAT_ACTIONS),
        divider,
        {
          label: m.insertImage,
          shortcut: "CmdOrCtrl+Shift+I",
          run: send({ id: "edit.insert-image" }),
        },
      ];
    case "view":
      return [
        {
          label: m.commandPalette,
          shortcut: "CmdOrCtrl+Shift+P",
          run: send({ id: "view.command-palette" }),
        },
        divider,
        { label: m.toggleSidebar, run: send({ id: "view.toggle-sidebar" }) },
        {
          label: m.sourceMode,
          shortcut: "CmdOrCtrl+/",
          checked: settings.sourceMode,
          run: () => updateSettings({ sourceMode: !settings.sourceMode }),
        },
        { label: m.nextTab, shortcut: "Control+Tab", run: send({ id: "view.next-tab" }) },
        {
          label: m.previousTab,
          shortcut: "Control+Shift+Tab",
          run: send({ id: "view.previous-tab" }),
        },
        {
          label: m.focusMode,
          shortcut: "F8",
          checked: settings.focusMode,
          run: () => updateSettings({ focusMode: !settings.focusMode }),
        },
        {
          label: m.typewriterMode,
          shortcut: "F9",
          checked: settings.typewriterMode,
          run: () => updateSettings({ typewriterMode: !settings.typewriterMode }),
        },
      ];
    case "help":
      return [
        { label: m.sampleDocument, run: send({ id: "help.sample-document" }) },
        {
          label: m.documentation,
          run: () => void window.open("https://github.com/shalemore/pupitre"),
        },
      ];
  }
}

function menuEntries(entries: readonly DemoMenuEntry[], parentId: string): MenuEntry[] {
  return entries.map((entry, index): MenuEntry => {
    if (entry === "separator") return { type: "separator" };
    const id = `${parentId}.${index}`;
    if (entry.run !== undefined) menuRuns.set(id, entry.run);
    return {
      type: "item",
      id,
      label: entry.label,
      ...(entry.shortcut === undefined ? {} : { shortcut: formatShortcut(entry.shortcut) }),
      ...(entry.enabled === undefined ? {} : { enabled: entry.enabled }),
      ...(entry.checked === undefined ? {} : { checked: entry.checked }),
      ...(entry.submenu === undefined ? {} : { submenu: menuEntries(entry.submenu, id) }),
    };
  });
}

function menuSnapshot(): Menus {
  menuRuns = new Map();
  return menusOf((menu) => menuEntries(menuItems(menu), menu));
}

let documentState: DocumentState = {
  hasDocument: false,
  hasPath: false,
  isDirty: false,
  canReopenTab: false,
};
window.addEventListener("beforeunload", (event) => documentState.isDirty && event.preventDefault());
// Fonts would need a permission prompt and a browser that has the API; the demo keeps the defaults
Object.defineProperty(window, "queryLocalFonts", { value: undefined });

/**
 * The question of unsaved changes. A browser's confirm offers two answers, while saving,
 * discarding and going back are three, so the demo shows the same dialog the desktop window does.
 */
function askUnsaved(fileName: string): Promise<UnsavedChoice> {
  const { dialogs } = labels();
  const dialog = document.createElement("dialog");
  dialog.className =
    "floating-panel m-auto w-[min(24rem,calc(100vw_-_2rem))] p-6 text-sm text-foreground backdrop:bg-black/30";
  dialog.setAttribute("aria-labelledby", "pupitre-unsaved-message");

  const message = document.createElement("p");
  message.id = "pupitre-unsaved-message";
  message.className = "font-medium";
  message.textContent = dialogs.unsavedMessage(fileName);
  const detail = document.createElement("p");
  detail.className = "mt-2 text-xs text-muted-foreground";
  detail.textContent = dialogs.unsavedDetail;
  const actions = document.createElement("div");
  actions.className = "mt-6 flex justify-end gap-2";

  const { promise, resolve } = Promise.withResolvers<UnsavedChoice>();
  const finish = (choice: UnsavedChoice) => {
    dialog.close();
    dialog.remove();
    resolve(choice);
  };
  const answer = (label: string, choice: UnsavedChoice, primary = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = primary
      ? "h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
      : "h-8 rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground";
    button.addEventListener("click", () => finish(choice));
    actions.append(button);
    return button;
  };
  const save = answer(dialogs.save, "save", true);
  answer(dialogs.dontSave, "discard");
  answer(dialogs.cancel, "cancel");

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    finish("cancel");
  });
  dialog.append(message, detail, actions);
  document.body.append(dialog);
  dialog.showModal();
  save.focus();
  return promise;
}

type Handlers = {
  [K in keyof InvokeChannels]: (
    ...args: Parameters<InvokeChannels[K]>
  ) => ReturnType<InvokeChannels[K]> | Promise<ReturnType<InvokeChannels[K]>>;
};

const nothing = () => undefined;
const handlers: Handlers = {
  "settings:update": updateSettings,
  "settings:reset": resetSetting,
  "settings:reveal": nothing,
  // A browser has no folders beside the page, so there are no imported themes to offer
  "themes:list": () => [],
  "themes:reveal": nothing,
  "workspace:set": nothing,
  "workspace:get": () => ({ root: null, active: false, exists: false, overrides: [] }),
  "workspace:use": nothing,
  "workspace:reveal": nothing,
  "document:open": pickFile,
  "folder:choose": () => DEMO_FOLDER,
  "document:read": async (path) => {
    const text = await dropped.get(path);
    if (text !== undefined) files.set(path, text);
    dropped.delete(path);
    return opened(path);
  },
  "draft:read": readDraft,
  "draft:write": writeDraft,
  "draft:clear": () => localStorage.removeItem(DRAFT_KEY),
  "folder:list": listFolder,
  "folder:pins": (root) => folderPins.get(root) ?? [],
  "folder:set-pins": (root, paths) => {
    const entries: PinnedEntry[] = [];
    for (const raw of paths) {
      const key = pinKeyOf(raw);
      if (key === undefined) continue;
      const path = `${root}/${key}`;
      const kind = files.has(path)
        ? "file"
        : [...files.keys()].some((file) => file.startsWith(`${path}/`))
          ? "directory"
          : undefined;
      if (kind === undefined) continue;
      entries.push({ name: key.split("/").at(-1) ?? key, path, kind, relative: key });
    }
    folderPins.set(root, entries);
  },
  // A browser has no folder to walk, so Quick Open has nothing to search in the demo
  "folder:files": () => [],
  "folder:previews": folderPreviews,
  "folder:search": () => ({ kind: "ok", files: [] }),
  // The demo folder lives in memory, so its files can be created, renamed and deleted like any other
  "folder:create": (parent, name, kind) => {
    const path = `${parent}/${name}`;
    if (kind === "file") {
      files.set(path, "");
      touchFile(path, true);
    }
    return path;
  },
  "path:rename": (path, name) => {
    const target = `${path.slice(0, path.lastIndexOf("/"))}/${name}`;
    const content = files.get(path) ?? "";
    const times = fileTimes.get(path);
    files.delete(path);
    files.set(target, content);
    fileTimes.delete(path);
    if (times !== undefined) fileTimes.set(target, times);
    return target;
  },
  "path:trash": (path) => {
    files.delete(path);
    fileTimes.delete(path);
  },
  "path:reveal": () => {},
  "path:locate": (path) => opened(path),
  // A browser has no native file picker to hand an image to the editor
  "image:pick": () => null,
  "folder:watch": nothing,
  "folder:unwatch": nothing,
  "document:watch": nothing,
  "document:unwatch": nothing,
  "document:peek": (path) => files.get(path),
  "document:exists": (path) => files.has(path),
  "document:write": (path, content) => {
    const created = !files.has(path);
    files.set(path, content);
    touchFile(path, created);
  },
  "dialog:choose-save-path": (suggestedName) => {
    const name = prompt(labels().menu.saveAs, suggestedName)?.trim();
    if (!name) return null;
    return opened(`${DEMO_FOLDER}/${DOCUMENT_FILE.test(name) ? name : `${name}.md`}`);
  },
  "document:save-image": (_path, _name, data) => URL.createObjectURL(new Blob([data.slice()])),
  // A browser has no file manager and no folder of its own to move a picture through
  "image:save-as": () => null,
  "image:move": () => null,
  "image:copy": () => null,
  "image:download": () => null,
  "document:print": () => {
    window.print();
  },
  "document:export-pdf": () => {
    window.print();
    return null;
  },
  "document:export-html": (suggestedName, html) => {
    // The page the desktop app writes next to the document is a file the browser downloads here
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = suggestedName;
    link.click();
    // The download reads the address after the click returns
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return suggestedName;
  },
  // A browser has no window it could render a page in on its own, so the demo leaves the export out
  "document:export-image": () => null,
  "history:list": () => [],
  "history:read": () => null,
  "dialog:confirm-unsaved": askUnsaved,
  "dialog:confirm-external-change": () => "keep",
  "dialog:confirm-deleted": () => "keep",
  "dialog:show-error": (message, detail) => alert(`${message}\n\n${detail}`),
  "window:open-settings": () => {
    window.open(
      `${location.origin}${location.pathname}#settings`,
      "pupitre-settings",
      "popup,width=960,height=720",
    );
  },
  "window:set-colors": nothing,
  "window:set-sidebar-widths": nothing,
  "app:show-about": nothing,
  "app:set-default-markdown-app": () => "failed",
  "app:dispatch": dispatch,
  "clipboard:write-text": (text) => void navigator.clipboard.writeText(text),
  "clipboard:read-text": () => navigator.clipboard.readText(),
  "clipboard:write-rich": async (text, html) => {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
    } catch {
      // A browser can refuse a rich clipboard write, a permission denied for instance; the text is
      // still worth copying then, which is what a copy button does
      await navigator.clipboard.writeText(text);
    }
  },
  "menu:items": menuSnapshot,
  "menu:click": (itemId) => menuRuns.get(itemId)?.(),
  "window:set-document-state": (state) => void (documentState = state),
  "window:close-confirmed": nothing,
  "window:minimize": nothing,
  "window:toggle-maximize": nothing,
  "window:close": nothing,
  "window:set-buttons-visible": nothing,
  "updater:get-status": () => ({ kind: "idle" }),
  "updater:check": nothing,
  "updater:download": nothing,
  "updater:install": nothing,
};

const desktop: DesktopApi = {
  platform,
  invoke: async <K extends keyof InvokeChannels>(
    channel: K,
    ...args: Parameters<InvokeChannels[K]>
  ) => {
    const handler: Handlers[K] = handlers[channel];
    return await handler(...args);
  },
  on: (channel, listener) => {
    const handle = (event: Event) => event instanceof CustomEvent && listener(event.detail);
    events.addEventListener(channel, handle);
    return () => events.removeEventListener(channel, handle);
  },
  initialState: {
    settings,
    settingsPath: "localStorage",
    firstRun,
    capabilities: {
      selfUpdate: false,
      revealFiles: false,
      setDefaultApp: false,
      systemFonts: false,
      zoom: false,
      folderParent: false,
    },
    recentFiles: [],
    captionSide: undefined,
    sidebarWidths: undefined,
    launchFile: isSettingsWindow ? undefined : ABOUT_PATH,
    themes: [],
  },
  getPathForFile: (file) => {
    const path = `${DEMO_FOLDER}/${file.name}`;
    dropped.set(path, file.text());
    return path;
  },
};

Object.defineProperty(window, "desktop", { value: desktop });
publishSettings();
