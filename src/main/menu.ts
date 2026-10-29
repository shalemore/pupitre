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
import {
  formatShortcut,
  type MenuEntry,
  type Menus,
  menusOf,
  withGroupSeparators,
} from "@shared/menu";
import { showAboutDialog } from "./about";
import { diagnosticsInfo } from "./diagnostics";
import { formatItems } from "./format-menu";
import { t } from "./i18n";
import { clearRecentFiles, getRecentFiles } from "./recent-files";
import { REPOSITORY_URL, reportIssueUrl } from "./report-issue";
import { getSettings, updateSettings } from "./settings-store";
import { dispatchToMainWindow, getMainWindow, showSettingsWindow } from "./windows";
import { resetZoom, stepZoom } from "./zoom";

const separator: MenuItemConstructorOptions = { type: "separator" };

let documentState: DocumentState = {
  hasDocument: false,
  hasPath: false,
  isDirty: false,
  canReopenTab: false,
};

function buildTemplate(): MenuItemConstructorOptions[] {
  const labels = t().menu;
  const isMac = process.platform === "darwin";
  // A document without a file has no versions kept of it
  const hasFile = documentState.hasDocument && documentState.hasPath;
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
        {
          label: labels.quickOpen,
          accelerator: "CmdOrCtrl+P",
          click: () => dispatchToMainWindow({ id: "file.quick-open" }),
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
        // No accelerator: CmdOrCtrl+P is Quick Open, as it is in Typora
        {
          label: labels.print,
          enabled: hasDocument,
          click: () => dispatchToMainWindow({ id: "file.print" }),
        },
        {
          label: labels.exportPdf,
          enabled: hasDocument,
          click: () => dispatchToMainWindow({ id: "file.export-pdf" }),
        },
        {
          label: labels.exportHtml,
          enabled: hasDocument,
          click: () => dispatchToMainWindow({ id: "file.export-html" }),
        },
        {
          label: labels.exportImage,
          enabled: hasDocument,
          click: () => dispatchToMainWindow({ id: "file.export-image" }),
        },
        separator,
        {
          label: labels.versionHistory,
          enabled: hasFile,
          click: () => dispatchToMainWindow({ id: "file.version-history" }),
        },
        separator,
        {
          label: labels.closeTab,
          accelerator: "CmdOrCtrl+W",
          enabled: hasDocument,
          click: () => dispatchToMainWindow({ id: "file.close-tab" }),
        },
        {
          label: labels.reopenTab,
          accelerator: "CmdOrCtrl+Shift+T",
          // Only a tab that was closed can come back, and closing one is the only thing that changes that
          enabled: documentState.canReopenTab,
          click: () => dispatchToMainWindow({ id: "file.reopen-tab" }),
        },
        {
          label: labels.closeWindow,
          // Ctrl+W closes a tab as it does everywhere else, so the window takes the longer one
          accelerator: "CmdOrCtrl+Shift+W",
          click: () => dispatchToMainWindow({ id: "window.close" }),
        },
        separator,
        ...(isMac ? [] : [preferences, separator]),
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
        {
          label: labels.copyHtml,
          accelerator: "CmdOrCtrl+Shift+C",
          enabled: hasDocument,
          click: () => dispatchToMainWindow({ id: "edit.copy-html" }),
        },
        { label: labels.paste, role: "paste" },
        {
          label: labels.pastePlain,
          // Electron gives this role no accelerator outside macOS, and the main window inserts the
          // clipboard's text itself so that the rich-text paste conversion does not see it; any
          // other window pastes through the role
          accelerator: "CmdOrCtrl+Shift+V",
          click: () => {
            const window = BrowserWindow.getFocusedWindow();
            if (window !== null && window !== getMainWindow()) {
              window.webContents.pasteAndMatchStyle();
              return;
            }
            dispatchToMainWindow({ id: "edit.paste-plain" });
          },
        },
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
        {
          label: labels.searchInFolder,
          accelerator: "CmdOrCtrl+Shift+F",
          click: () => dispatchToMainWindow({ id: "edit.search-workspace" }),
        },
      ],
    },
    {
      id: "paragraphMenu",
      label: labels.paragraphMenu,
      enabled: hasDocument,
      // The Table action inside the groups writes the size its shortcut does; this entry asks for
      // a size of its own, which no formatting action can do
      submenu: [
        ...withGroupSeparators(
          PARAGRAPH_MENU_GROUPS.map((group) => formatItems(group, dispatchToMainWindow)),
          separator,
        ),
        separator,
        {
          label: labels.insertTable,
          click: () => dispatchToMainWindow({ id: "edit.insert-table" }),
        },
      ],
    },
    {
      id: "format",
      label: labels.format,
      enabled: hasDocument,
      submenu: [
        ...formatItems(INLINE_FORMAT_ACTIONS, dispatchToMainWindow),
        separator,
        {
          label: labels.insertImage,
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => dispatchToMainWindow({ id: "edit.insert-image" }),
        },
      ],
    },
    {
      id: "view",
      label: labels.view,
      submenu: [
        {
          label: labels.commandPalette,
          accelerator: "CmdOrCtrl+Shift+P",
          click: () => dispatchToMainWindow({ id: "view.command-palette" }),
        },
        separator,
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
        // Ctrl+Tab stays Ctrl on every platform: Cmd+Tab is the system's own window switcher
        {
          label: labels.nextTab,
          accelerator: "Control+Tab",
          enabled: hasDocument,
          click: () => dispatchToMainWindow({ id: "view.next-tab" }),
        },
        {
          label: labels.previousTab,
          accelerator: "Control+Shift+Tab",
          enabled: hasDocument,
          click: () => dispatchToMainWindow({ id: "view.previous-tab" }),
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
        {
          label: labels.sourceMode,
          type: "checkbox",
          accelerator: "CmdOrCtrl+/",
          checked: getSettings().sourceMode,
          click: () => updateSettings({ sourceMode: !getSettings().sourceMode }),
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
        // Ctrl+0 belongs to "Paragraph", as in Typora, and Ctrl+Shift+digit belongs to the
        // keyboard layouts of Windows, which never passes it on; R carries the reset instead
        { label: labels.resetZoom, accelerator: "CmdOrCtrl+Shift+R", click: resetZoom },
        separator,
        { label: labels.fullScreen, role: "togglefullscreen" },
        ...(app.isPackaged
          ? []
          : [
              separator,
              { role: "reload" } as const,
              // F12 keeps the developer tools away from Insert Image's Ctrl+Shift+I
              { role: "toggleDevTools", accelerator: "F12" } as const,
            ]),
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
          click: () => void shell.openExternal(reportIssueUrl(diagnosticsInfo())),
        },
        ...(isMac ? [] : [separator, about]),
      ],
    },
  ];
}

/**
 * Names every item under a top-level menu after its position, so a menu drawn by the window can
 * send back the entry that was picked. Separators are never picked, and one instance of them is
 * shared by the whole template.
 */
function indexItems(
  items: readonly MenuItemConstructorOptions[],
  parentId: string,
): MenuItemConstructorOptions[] {
  return items.map((item, index) => {
    if (item.type === "separator") return item;
    const id = `${parentId}.${index}`;
    const indexed = { ...item, id };
    if (Array.isArray(item.submenu)) indexed.submenu = indexItems(item.submenu, id);
    return indexed;
  });
}

function buildApplicationMenu(): Menu {
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
  Menu.setApplicationMenu(buildApplicationMenu());
}

export function setDocumentState(state: DocumentState): void {
  // The menu only cares whether a document is open, whether a file is behind it and whether a closed
  // tab can come back; the dirty state can change on every keystroke and must not rebuild the menu
  const menuChanged =
    state.hasDocument !== documentState.hasDocument ||
    state.hasPath !== documentState.hasPath ||
    state.canReopenTab !== documentState.canReopenTab;
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
    const item = Menu.getApplicationMenu()?.items.find((candidate) => candidate.id === menu);
    const submenu: Menu | undefined = item?.submenu ?? undefined;
    return submenu === undefined ? [] : entriesOf(submenu.items);
  });
}

/** Runs the entry the drawn menu bar reported; the id comes from the menu the snapshot was made of. */
export function clickMenuItem(itemId: string): void {
  const item = Menu.getApplicationMenu()?.getMenuItemById(itemId);
  if (!item) return;
  const window = BrowserWindow.getFocusedWindow() ?? getMainWindow();
  // Electron fills in what a role does; the app's own handlers take none of these arguments
  Reflect.apply(item.click, item, [undefined, window, window?.webContents]);
}
