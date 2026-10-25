import type {
  AppCommand,
  DesktopApi,
  DesktopPlatform,
  FolderEntry,
  InvokeChannels,
  OpenedDocument,
  RendererEvents,
} from "@shared/desktop-api";
import {
  FORMAT_ACTIONS,
  INLINE_FORMAT_ACTIONS,
  PARAGRAPH_MENU_GROUPS,
  type FormatAction,
} from "@shared/format";
import { getDictionary, resolveLocale } from "@shared/i18n";
import { formatShortcut, type MenuEntry, type Menus, menusOf, type TopMenu } from "@shared/menu";
import {
  DEFAULT_SETTINGS,
  patchSettingsFile,
  resolveSettings,
  type SettingKey,
  type Settings,
  settingsFileSchema,
  withoutSetting,
} from "@shared/settings";
import { getSampleDocument } from "@/features/samples/sample-document";
import about from "./demo/about.md?raw";

/**
 * The window.desktop of the demo in a browser: what the desktop app gets from its main process,
 * kept in the page. Settings live in localStorage, the files are a few in memory, and what a
 * browser cannot do (updates, folder settings, window controls) does nothing.
 */

const SETTINGS_KEY = "pupitre:settings";
/** A browser is closest to Linux: shortcuts are written with Ctrl and windows have no system menu bar. */
const platform: DesktopPlatform = "linux";
const DEMO_FOLDER = "/demo";
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
  document.documentElement.style.zoom = String(settings.zoom / 100);
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

// Files: a small folder in memory
// The language follows the setting, so it is read when it is needed
const currentLocale = () => resolveLocale(settings.locale, navigator.languages);
const labels = () => getDictionary(currentLocale());
const ABOUT_PATH = `${DEMO_FOLDER}/About this demo.md`;
const files = new Map([
  [ABOUT_PATH, about],
  [`${DEMO_FOLDER}/Pupitre Guide.md`, getSampleDocument(currentLocale())],
]);
// Files dropped on the page are read after the page asked for their path
const dropped = new Map<string, Promise<string>>();

function opened(path: string): OpenedDocument {
  const folder = path.slice(0, path.lastIndexOf("/"));
  return {
    path,
    folder,
    baseUrl: siteUrl,
    content: files.get(path) ?? "",
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
  return [...entries.values()].toSorted(
    (a, b) =>
      Number(b.kind === "directory") - Number(a.kind === "directory") ||
      a.name.localeCompare(b.name),
  );
}

function pickFile(): Promise<OpenedDocument | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,.mdown,.txt";
    input.addEventListener("cancel", () => resolve(null));
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const path = `${DEMO_FOLDER}/${file.name}`;
      files.set(path, await file.text());
      resolve(opened(path));
    });
    input.click();
  });
}

// Menus: the window draws the menu bar itself, so the demo describes its entries the way the app's
// main process does and keeps what each of them runs
type DemoMenuEntry =
  | "separator"
  | {
      label: string;
      /** An Electron accelerator; it is written the way the platform shows it. */
      shortcut?: string;
      checked?: boolean;
      run?: () => void;
      submenu?: readonly DemoMenuEntry[];
    };

const divider: DemoMenuEntry = "separator";
// The drawn menu reports the id of the entry that was picked; only one menu is open at a time
let menuRuns = new Map<string, () => void>();

function menuItems(menu: TopMenu): DemoMenuEntry[] {
  const { menu: m, format } = labels();
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
        divider,
        { label: m.save, run: send({ id: "file.save" }) },
        { label: m.saveAs, run: send({ id: "file.save-as" }) },
        { label: m.exportPdf, run: send({ id: "file.export-pdf" }) },
        divider,
        { label: m.preferences, run: () => void handlers["window:open-settings"]() },
      ];
    case "edit":
      return [
        { label: m.find, run: send({ id: "edit.find" }) },
        { label: m.replace, run: send({ id: "edit.replace" }) },
      ];
    case "paragraphMenu":
      return PARAGRAPH_MENU_GROUPS.flatMap((group, index) => {
        const items = formatItems(group);
        return index === 0 ? items : items.toSpliced(0, 0, divider);
      });
    case "format":
      return formatItems(INLINE_FORMAT_ACTIONS);
    case "view":
      return [
        { label: m.toggleSidebar, run: send({ id: "view.toggle-sidebar" }) },
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
      ...(entry.checked === undefined ? {} : { checked: entry.checked }),
      ...(entry.submenu === undefined ? {} : { submenu: menuEntries(entry.submenu, id) }),
    };
  });
}

function menuSnapshot(): Menus {
  menuRuns = new Map();
  return menusOf((menu) => menuEntries(menuItems(menu), menu));
}

let dirty = false;
window.addEventListener("beforeunload", (event) => dirty && event.preventDefault());
// Fonts would need a permission prompt and a browser that has the API; the demo keeps the defaults
Object.defineProperty(window, "queryLocalFonts", { value: undefined });

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
  "folder:list": listFolder,
  // The demo folder lives in memory, so its files can be created, renamed and deleted like any other
  "folder:create": (parent, name, kind) => {
    const path = `${parent}/${name}`;
    if (kind === "file") files.set(path, "");
    return path;
  },
  "path:rename": (path, name) => {
    const target = `${path.slice(0, path.lastIndexOf("/"))}/${name}`;
    const content = files.get(path) ?? "";
    files.delete(path);
    files.set(target, content);
    return target;
  },
  "path:trash": (path) => void files.delete(path),
  "path:locate": (path) => opened(path),
  "folder:watch": nothing,
  "folder:unwatch": nothing,
  "document:watch": nothing,
  "document:unwatch": nothing,
  "document:peek": (path) => files.get(path),
  "document:exists": (path) => files.has(path),
  "document:write": (path, content) => void files.set(path, content),
  "dialog:choose-save-path": (suggestedName) => {
    const name = prompt(labels().menu.saveAs, suggestedName)?.trim();
    if (!name) return null;
    return opened(
      `${DEMO_FOLDER}/${/\.(md|markdown|mdown|txt)$/i.test(name) ? name : `${name}.md`}`,
    );
  },
  "document:save-image": (_path, _name, data) => URL.createObjectURL(new Blob([data.slice()])),
  "document:export-pdf": () => {
    window.print();
    return null;
  },
  "dialog:confirm-unsaved": (fileName) => {
    const { dialogs } = labels();
    if (confirm(`${dialogs.unsavedMessage(fileName)}\n\n${dialogs.save}?`)) return "save";
    return confirm(`${dialogs.dontSave}?`) ? "discard" : "cancel";
  },
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
  "app:show-about": nothing,
  "app:set-default-markdown-app": () => "failed",
  "app:dispatch": dispatch,
  "clipboard:write-text": (text) => void navigator.clipboard.writeText(text),
  "menu:items": menuSnapshot,
  "menu:click": (itemId) => menuRuns.get(itemId)?.(),
  "window:set-document-state": (state) => void (dirty = state.isDirty),
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
  versions: { electron: "web", chrome: "" },
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
    canSelfUpdate: false,
    recentFiles: [],
    captionSide: undefined,
    launchFile: isSettingsWindow ? undefined : ABOUT_PATH,
  },
  getPathForFile: (file) => {
    const path = `${DEMO_FOLDER}/${file.name}`;
    dropped.set(path, file.text());
    return path;
  },
};

Object.defineProperty(window, "desktop", { value: desktop });
publishSettings();
