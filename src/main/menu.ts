import { basename } from "node:path";
import {
  app,
  BrowserWindow,
  Menu,
  type MenuItem,
  type MenuItemConstructorOptions,
  nativeTheme,
  shell,
} from "electron";
import type { DocumentState } from "@shared/desktop-api";
import { INLINE_FORMAT_ACTIONS, PARAGRAPH_MENU_GROUPS } from "@shared/format";
import { formatShortcut, type MenuEntry, type Menus, menusOf } from "@shared/menu";
import { formatItems } from "./format-menu";
import { showAboutDialog } from "./about";
import { t } from "./i18n";
import { clearRecentFiles, getRecentFiles } from "./recent-files";
import { getSettings, updateSettings } from "./settings-store";
import { dispatchToMainWindow, getMainWindow, showSettingsWindow } from "./windows";
import { resetZoom, stepZoom } from "./zoom";

const REPOSITORY_URL = "https://github.com/shalemore/pupitre";
const separator: MenuItemConstructorOptions = { type: "separator" };

let documentState: DocumentState = { hasDocument: false, isDirty: false };

function buildTemplate(): MenuItemConstructorOptions[] {
  const labels = t().menu;
  const isMac = process.platform === "darwin";
  const { hasDocument } = documentState;
  const recentFiles = getRecentFiles();

  const about: MenuItemConstructorOptions = {
    label: labels.about,
    click: () => {
      const window = getMainWindow();
      if (window) showAboutDialog(window);
    },
  };
  const preferences: MenuItemConstructorOptions = {
    label: labels.preferences,
    accelerator: "CmdOrCtrl+,",
    click: showSettingsWindow,
  };
  const recentMenu: MenuItemConstructorOptions[] =
    recentFiles.length === 0
      ? [{ label: labels.noRecentFiles, enabled: false }]
      : [
          ...recentFiles.map((path) => ({
            label: basename(path),
            sublabel: path,
            click: () => dispatchToMainWindow({ id: "file.open-path", path }),
          })),
          separator,
          {
            label: labels.clearRecent,
            click: clearRecentFiles,
          },
        ];
  const appMenu: MenuItemConstructorOptions = {
    id: "app",
    label: app.name,
    submenu: [
      about,
      separator,
      preferences,
      separator,
      { role: "services" },
      separator,
      { role: "hide" },
      { role: "hideOthers" },
      { role: "unhide" },
      separator,
      { role: "quit" },
    ],
  };

  return [
    ...(isMac ? [appMenu] : []),
    {
      id: "file",
      label: labels.file,
      submenu: [
        {
          label: labels.newFile,
          accelerator: "CmdOrCtrl+N",
          click: () => dispatchToMainWindow({ id: "file.new" }),
        },
        {
          label: labels.openFile,
          accelerator: "CmdOrCtrl+O",
          click: () => dispatchToMainWindow({ id: "file.open" }),
        },
        {
          label: labels.openFolder,
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => dispatchToMainWindow({ id: "file.open-folder" }),
        },
        { label: labels.openRecent, submenu: recentMenu },
        separator,
        {
          label: labels.save,
          accelerator: "CmdOrCtrl+S",
          enabled: hasDocument,
          click: () => dispatchToMainWindow({ id: "file.save" }),
        },
        {
          label: labels.saveAs,
          accelerator: "CmdOrCtrl+Shift+S",
          enabled: hasDocument,
          click: () => dispatchToMainWindow({ id: "file.save-as" }),
        },
        {
          label: labels.exportPdf,
          enabled: hasDocument,
          click: () => dispatchToMainWindow({ id: "file.export-pdf" }),
        },
        separator,
        ...(isMac ? [] : [preferences, separator]),
        { label: labels.close, role: "close" },
        ...(isMac ? [] : [{ label: labels.quit, role: "quit" } as const]),
      ],
    },
    {
      id: "edit",
      label: labels.edit,
      submenu: [
        { label: labels.undo, role: "undo" },
        { label: labels.redo, role: "redo" },
        separator,
        { label: labels.cut, role: "cut" },
        { label: labels.copy, role: "copy" },
        { label: labels.paste, role: "paste" },
        { label: labels.pastePlain, role: "pasteAndMatchStyle" },
        { label: labels.selectAll, role: "selectAll" },
        separator,
        {
          label: labels.find,
          accelerator: "CmdOrCtrl+F",
          enabled: hasDocument,
          click: () => dispatchToMainWindow({ id: "edit.find" }),
        },
        {
          label: labels.replace,
          accelerator: isMac ? "Cmd+Alt+F" : "Ctrl+H",
          enabled: hasDocument,
          click: () => dispatchToMainWindow({ id: "edit.replace" }),
        },
      ],
    },
    {
      id: "paragraphMenu",
      label: labels.paragraphMenu,
      enabled: hasDocument,
      submenu: PARAGRAPH_MENU_GROUPS.flatMap((group, index) => {
        const items = formatItems(group, dispatchToMainWindow);
        return index === 0 ? items : [separator].concat(items);
      }),
    },
    {
      id: "format",
      label: labels.format,
      enabled: hasDocument,
      submenu: formatItems(INLINE_FORMAT_ACTIONS, dispatchToMainWindow),
    },
    {
      id: "view",
      label: labels.view,
      submenu: [
        {
          label: labels.toggleSidebar,
          accelerator: "CmdOrCtrl+Shift+L",
          click: () => dispatchToMainWindow({ id: "view.toggle-sidebar" }),
        },
        {
          label: labels.toggleTheme,
          click: () =>
            updateSettings({ colorScheme: nativeTheme.shouldUseDarkColors ? "light" : "dark" }),
        },
        separator,
        {
          label: labels.focusMode,
          type: "checkbox",
          accelerator: "F8",
          checked: getSettings().focusMode,
          click: () => updateSettings({ focusMode: !getSettings().focusMode }),
        },
        {
          label: labels.typewriterMode,
          type: "checkbox",
          accelerator: "F9",
          checked: getSettings().typewriterMode,
          click: () => updateSettings({ typewriterMode: !getSettings().typewriterMode }),
        },
        separator,
        { label: labels.zoomIn, accelerator: "CmdOrCtrl+Plus", click: () => stepZoom("in") },
        // The same shortcut without Shift, which is what the key is on most keyboards
        {
          label: labels.zoomIn,
          accelerator: "CmdOrCtrl+=",
          visible: false,
          click: () => stepZoom("in"),
        },
        { label: labels.zoomOut, accelerator: "CmdOrCtrl+-", click: () => stepZoom("out") },
        // Ctrl+0 belongs to "Paragraph", as in Typora
        { label: labels.resetZoom, accelerator: "CmdOrCtrl+Shift+0", click: resetZoom },
        separator,
        { label: labels.fullScreen, role: "togglefullscreen" },
        ...(app.isPackaged
          ? []
          : [separator, { role: "reload" } as const, { role: "toggleDevTools" } as const]),
      ],
    },
    ...(isMac ? [{ role: "windowMenu" } as const] : []),
    {
      id: "help",
      label: labels.help,
      role: "help",
      submenu: [
        {
          label: labels.sampleDocument,
          click: () => dispatchToMainWindow({ id: "help.sample-document" }),
        },
        { label: labels.documentation, click: () => void shell.openExternal(REPOSITORY_URL) },
        {
          label: labels.reportIssue,
          click: () => void shell.openExternal(`${REPOSITORY_URL}/issues`),
        },
        ...(isMac ? [] : [separator, about]),
      ],
    },
  ];
}

/** What picking an entry runs: the item's own handler, or a role that only Electron knows how to run. */
type MenuRunner = NonNullable<MenuItemConstructorOptions["click"]> | { role: string };

// The menu is rebuilt whole on any change, so its runner map is too
let runners = new Map<string, MenuRunner>();
let applicationMenu: Menu | undefined;

/**
 * Names every item under a top-level menu after its position, so a menu drawn by the window can
 * send back the entry that was picked, and remembers what that entry runs. Separators are never
 * picked, and one instance of them is shared by the whole template.
 */
function indexItems(
  items: readonly MenuItemConstructorOptions[],
  parentId: string,
): MenuItemConstructorOptions[] {
  return items.map((item, index) => {
    if (item.type === "separator") return item;
    const id = `${parentId}.${index}`;
    if (item.role !== undefined) runners.set(id, { role: item.role });
    else if (item.click !== undefined) runners.set(id, item.click);
    const indexed = Object.assign({}, item, { id });
    if (Array.isArray(item.submenu)) indexed.submenu = indexItems(item.submenu, id);
    return indexed;
  });
}

function buildApplicationMenu(): Menu {
  runners = new Map();
  const template = buildTemplate();
  for (const [index, top] of template.entries()) {
    const id = top.id ?? `menu${index}`;
    top.id = id;
    if (Array.isArray(top.submenu)) top.submenu = indexItems(top.submenu, id);
  }
  return Menu.buildFromTemplate(template);
}

/** The menu depends on the language, recent files and document state; rebuilding it whole on any change is the simplest approach and fast enough. */
export function rebuildApplicationMenu(): void {
  applicationMenu = buildApplicationMenu();
  Menu.setApplicationMenu(applicationMenu);
}

export function setDocumentState(state: DocumentState): void {
  // The menu only cares whether a document is open; the dirty state can change on every keystroke and must not rebuild the menu
  const menuChanged = state.hasDocument !== documentState.hasDocument;
  documentState = state;
  if (menuChanged) rebuildApplicationMenu();
}

/** Electron fills in the accelerator a role gets by default, so what the native menu bar showed is what the drawn one shows. */
function shortcutOf(item: MenuItem): string | undefined {
  return item.accelerator === null ? undefined : formatShortcut(item.accelerator);
}

function entriesOf(items: readonly MenuItem[]): MenuEntry[] {
  return items.flatMap((item): MenuEntry[] => {
    // Hidden items only exist to give an accelerator a second spelling
    if (!item.visible) return [];
    if (item.type === "separator") return [{ type: "separator" }];
    const shortcut = shortcutOf(item);
    // Electron gives an item without a submenu null there, whatever its types say
    const submenu: Menu | undefined = item.submenu ?? undefined;
    return [
      {
        type: "item",
        id: item.id,
        label: item.label,
        ...(item.sublabel ? { detail: item.sublabel } : {}),
        ...(shortcut === undefined ? {} : { shortcut }),
        enabled: item.enabled,
        ...(item.type === "checkbox" ? { checked: item.checked } : {}),
        ...(submenu === undefined ? {} : { submenu: entriesOf(submenu.items) }),
      },
    ];
  });
}

/** The drawn menu bar asks for this each time it opens a menu, because the entries follow the settings, the recent files and the open document. */
export function menuSnapshot(): Menus {
  return menusOf((menu) => {
    const item = applicationMenu?.items.find((candidate) => candidate.id === menu);
    const submenu: Menu | undefined = item?.submenu ?? undefined;
    return submenu === undefined ? [] : entriesOf(submenu.items);
  });
}

/** Runs a role, which Electron implements only inside its own menus. */
function runRole(role: string): void {
  const window = BrowserWindow.getFocusedWindow() ?? getMainWindow();
  const contents = window?.webContents;
  switch (role) {
    case "undo":
      return contents?.undo();
    case "redo":
      return contents?.redo();
    case "cut":
      return contents?.cut();
    case "copy":
      return contents?.copy();
    case "paste":
      return contents?.paste();
    case "pasteAndMatchStyle":
      return contents?.pasteAndMatchStyle();
    case "selectAll":
      return contents?.selectAll();
    case "delete":
      return contents?.delete();
    case "close":
      return window?.close();
    case "quit":
      return app.quit();
    case "togglefullscreen":
      return window?.setFullScreen(!window.isFullScreen());
    case "reload":
      return contents?.reload();
    case "toggleDevTools":
      return contents?.toggleDevTools();
    default:
      // The remaining roles only appear in the macOS system menu bar
      return;
  }
}

/** Runs the entry the drawn menu bar reported; the id comes from the menu the snapshot was made of. */
export function clickMenuItem(itemId: string): void {
  const runner = runners.get(itemId);
  if (runner === undefined) return;
  if (typeof runner === "function") {
    // Electron would hand the handler the item, the window and the event; the app's handlers take none of them
    void Reflect.apply(runner, undefined, []);
    return;
  }
  runRole(runner.role);
}
