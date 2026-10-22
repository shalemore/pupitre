import { basename } from "node:path";
import {
  app,
  type BrowserWindow,
  Menu,
  type MenuItemConstructorOptions,
  nativeTheme,
  shell,
} from "electron";
import type { DocumentState, TopMenu } from "@shared/desktop-api";
import { showAboutDialog } from "./about";
import { t } from "./i18n";
import { getSettings, updateSettings } from "./settings-store";
import { dispatchToMainWindow, getMainWindow, showSettingsWindow } from "./windows";

const REPOSITORY_URL = "https://github.com/shalemore/pupitre";
const separator: MenuItemConstructorOptions = { type: "separator" };

let documentState: DocumentState = { hasDocument: false };

function buildTemplate(): MenuItemConstructorOptions[] {
  const labels = t().menu;
  const isMac = process.platform === "darwin";
  const { hasDocument } = documentState;
  const { recentFiles } = getSettings();

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
            click: () => {
              app.clearRecentDocuments();
              updateSettings({ recentFiles: [] });
            },
          },
        ];
  const appMenu: MenuItemConstructorOptions = {
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
        { label: labels.zoomIn, role: "zoomIn" },
        { label: labels.zoomOut, role: "zoomOut" },
        { label: labels.resetZoom, role: "resetZoom" },
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

/** The menu depends on the language, recent files and document state; rebuilding it whole on any change is the simplest approach and fast enough. */
export function rebuildApplicationMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildTemplate()));
}

export function setDocumentState(state: DocumentState): void {
  documentState = state;
  rebuildApplicationMenu();
}

/** Menu buttons in the Windows and Linux title bar pop up the matching native submenu below the button. */
export function popupTopMenu(window: BrowserWindow, menu: TopMenu, x: number, y: number): void {
  const submenu = Menu.getApplicationMenu()?.getMenuItemById(menu)?.submenu;
  submenu?.popup({ window, x: Math.round(x), y: Math.round(y) });
}
