import { basename } from "node:path";
import type { DocumentState } from "@pupitre/desktop-api";
import { INLINE_FORMAT_ACTIONS, PARAGRAPH_MENU_GROUPS } from "@pupitre/desktop-api/format-actions";
import {
  formatShortcut,
  type MenuEntry,
  type Menus,
  menusOf,
  withGroupSeparators,
} from "@pupitre/desktop-api/menu";
import { type BooleanSettingKey, isBooleanSettingKey } from "@pupitre/settings";
import {
  app,
  BrowserWindow,
  Menu,
  type MenuItem,
  type MenuItemConstructorOptions,
  shell,
} from "electron";
import { replaceShortcut, SHORTCUTS } from "@shared/shortcuts";
import { diagnosticsInfo } from "../diagnostics/diagnostics";
import { REPOSITORY_URL, reportIssueUrl } from "../diagnostics/report-issue";
import { clearRecentFiles, getRecentFiles } from "../files/recent-files";
import { t } from "../i18n";
import { toggleColorScheme } from "../settings/color-scheme";
import { getSettings, updateSettings } from "../settings/settings-store";
import { dispatchToMainWindow, getMainWindow, showSettingsWindow } from "../windows/windows";
import { resetZoom, stepZoom } from "../windows/zoom";
import { showAboutDialog } from "./about";
import { formatItems } from "./format-menu";

const separator: MenuItemConstructorOptions = { type: "separator" };

/** A menu item that a drawn check box follows the setting of. */
type SettingMenu = Omit<MenuItemConstructorOptions, "submenu"> & {
  setting?: BooleanSettingKey;
  /** The label names the setting being off, so the drawn check has to turn around. */
  invert?: boolean;
  submenu?: SettingMenu[] | Menu;
};

let documentState: DocumentState = {
  hasDocument: false,
  hasText: false,
  isMarkdown: false,
  hasPath: false,
  isDirty: false,
  canReopenTab: false,
};

/**
 * A menu item for a shortcut and its other spellings: the first is the one the menu shows, and the
 * rest are hidden, since Electron reads some keys as more than one accelerator (see entriesOf).
 * The window reads the real keys itself (see zoom-shortcuts.ts), so on Windows and Linux these
 * accelerators are only displayed; macOS registers them.
 */
function shortcutItems(
  label: string,
  accelerators: readonly string[],
  click: () => void,
): MenuItemConstructorOptions[] {
  return accelerators.map((accelerator, index) => ({
    label,
    accelerator,
    registerAccelerator: false,
    visible: index === 0,
    click,
  }));
}

function buildTemplate(): SettingMenu[] {
  const labels = t().menu;
  const isMac = process.platform === "darwin";
  // A document without a file has no versions kept of it
  const hasFile = documentState.hasText && documentState.hasPath;
  const { hasDocument, hasText } = documentState;
  // Paragraph and Format write Markdown syntax, so they have nothing to do in a text or code file
  const canFormat = hasText && documentState.isMarkdown;
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
    accelerator: SHORTCUTS.preferences,
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
          accelerator: SHORTCUTS.newFile,
          click: () => dispatchToMainWindow({ id: "file.new" }),
        },
        {
          label: labels.openFile,
          accelerator: SHORTCUTS.openFile,
          click: () => dispatchToMainWindow({ id: "file.open" }),
        },
        {
          label: labels.openFolder,
          accelerator: SHORTCUTS.openFolder,
          click: () => dispatchToMainWindow({ id: "file.open-folder" }),
        },
        {
          label: labels.quickOpen,
          accelerator: SHORTCUTS.quickOpen,
          click: () => dispatchToMainWindow({ id: "file.quick-open" }),
        },
        { label: labels.openRecent, submenu: recentMenu },
        separator,
        {
          label: labels.save,
          accelerator: SHORTCUTS.save,
          enabled: hasText,
          click: () => dispatchToMainWindow({ id: "file.save" }),
        },
        {
          label: labels.saveAs,
          accelerator: SHORTCUTS.saveAs,
          enabled: hasText,
          click: () => dispatchToMainWindow({ id: "file.save-as" }),
        },
        // No accelerator: CmdOrCtrl+P is Quick Open, as it is in Typora
        {
          label: labels.print,
          enabled: hasText,
          click: () => dispatchToMainWindow({ id: "file.print" }),
        },
        {
          label: labels.exportPdf,
          enabled: hasText,
          click: () => dispatchToMainWindow({ id: "file.export-pdf" }),
        },
        {
          label: labels.exportHtml,
          enabled: hasText,
          click: () => dispatchToMainWindow({ id: "file.export-html" }),
        },
        {
          label: labels.exportImage,
          enabled: hasText,
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
          accelerator: SHORTCUTS.closeTab,
          enabled: hasDocument,
          click: () => dispatchToMainWindow({ id: "file.close-tab" }),
        },
        {
          label: labels.reopenTab,
          accelerator: SHORTCUTS.reopenTab,
          // Only a tab that was closed can come back, and closing one is the only thing that changes that
          enabled: documentState.canReopenTab,
          click: () => dispatchToMainWindow({ id: "file.reopen-tab" }),
        },
        {
          label: labels.closeWindow,
          // Ctrl+W closes a tab as it does everywhere else, so the window takes the longer one
          accelerator: SHORTCUTS.closeWindow,
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
          accelerator: SHORTCUTS.copyHtml,
          enabled: hasText,
          click: () => dispatchToMainWindow({ id: "edit.copy-html" }),
        },
        { label: labels.paste, role: "paste" },
        {
          label: labels.pastePlain,
          // Electron gives this role no accelerator outside macOS, and the main window inserts the
          // clipboard's text itself so that the rich-text paste conversion does not see it; any
          // other window pastes through the role
          accelerator: SHORTCUTS.pastePlain,
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
          accelerator: SHORTCUTS.find,
          enabled: hasText,
          click: () => dispatchToMainWindow({ id: "edit.find" }),
        },
        {
          label: labels.replace,
          accelerator: replaceShortcut(process.platform),
          enabled: hasText,
          click: () => dispatchToMainWindow({ id: "edit.replace" }),
        },
        {
          label: labels.searchInFolder,
          accelerator: SHORTCUTS.searchWorkspace,
          click: () => dispatchToMainWindow({ id: "edit.search-workspace" }),
        },
      ],
    },
    {
      id: "paragraphMenu",
      label: labels.paragraphMenu,
      enabled: canFormat,
      // The Table action inside the groups writes the size its shortcut does; this entry asks for
      // a size of its own, which no formatting action can do
      submenu: [
        ...withGroupSeparators(
          PARAGRAPH_MENU_GROUPS.map((group) => formatItems(group, dispatchToMainWindow, canFormat)),
          separator,
        ),
        separator,
        {
          label: labels.insertTable,
          enabled: canFormat,
          click: () => dispatchToMainWindow({ id: "edit.insert-table" }),
        },
      ],
    },
    {
      id: "format",
      label: labels.format,
      enabled: canFormat,
      submenu: [
        ...formatItems(INLINE_FORMAT_ACTIONS, dispatchToMainWindow, canFormat),
        separator,
        {
          label: labels.insertImage,
          accelerator: SHORTCUTS.insertImage,
          enabled: canFormat,
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
          accelerator: SHORTCUTS.commandPalette,
          click: () => dispatchToMainWindow({ id: "view.command-palette" }),
        },
        separator,
        {
          label: labels.hideSidebar,
          type: "checkbox",
          accelerator: SHORTCUTS.toggleSidebar,
          checked: !getSettings().sidebarVisible,
          setting: "sidebarVisible",
          invert: true,
          click: () => updateSettings({ sidebarVisible: !getSettings().sidebarVisible }),
        },
        {
          label: labels.toggleTheme,
          accelerator: SHORTCUTS.toggleTheme,
          // The window reads this key itself so that a held key does not strobe the scheme; on
          // Windows and Linux the menu only shows it (see shortcuts.ts)
          registerAccelerator: false,
          click: toggleColorScheme,
        },
        separator,
        // Ctrl+Tab stays Ctrl on every platform: Cmd+Tab is the system's own window switcher
        {
          label: labels.nextTab,
          accelerator: SHORTCUTS.nextTab,
          enabled: hasDocument,
          click: () => dispatchToMainWindow({ id: "view.next-tab" }),
        },
        {
          label: labels.previousTab,
          accelerator: SHORTCUTS.previousTab,
          enabled: hasDocument,
          click: () => dispatchToMainWindow({ id: "view.previous-tab" }),
        },
        separator,
        {
          label: labels.focusMode,
          type: "checkbox",
          accelerator: SHORTCUTS.focusMode,
          checked: getSettings().focusMode,
          setting: "focusMode",
          click: () => updateSettings({ focusMode: !getSettings().focusMode }),
        },
        {
          label: labels.typewriterMode,
          type: "checkbox",
          accelerator: SHORTCUTS.typewriterMode,
          checked: getSettings().typewriterMode,
          setting: "typewriterMode",
          click: () => updateSettings({ typewriterMode: !getSettings().typewriterMode }),
        },
        {
          label: labels.sourceMode,
          type: "checkbox",
          accelerator: SHORTCUTS.sourceMode,
          checked: getSettings().sourceMode,
          setting: "sourceMode",
          click: () => updateSettings({ sourceMode: !getSettings().sourceMode }),
        },
        separator,
        // The main row, the keypad, and the spellings Electron reads for the same keys
        ...shortcutItems(labels.zoomIn, [SHORTCUTS.zoomIn, "CmdOrCtrl+=", "CmdOrCtrl+numadd"], () =>
          stepZoom("in"),
        ),
        ...shortcutItems(labels.zoomOut, [SHORTCUTS.zoomOut, "CmdOrCtrl+numsub"], () =>
          stepZoom("out"),
        ),
        // Ctrl+0 is what other apps reset the zoom with; Shift+0 is ")" and the keypad's zero
        // carries Ins. Ctrl+Shift+R stays as the key the app used before
        ...shortcutItems(
          labels.resetZoom,
          [SHORTCUTS.resetZoom, "CmdOrCtrl+num0", "CmdOrCtrl+Shift+0", SHORTCUTS.legacyResetZoom],
          resetZoom,
        ),
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
function indexItems(items: readonly SettingMenu[], parentId: string): SettingMenu[] {
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
    state.hasText !== documentState.hasText ||
    state.isMarkdown !== documentState.isMarkdown ||
    state.hasPath !== documentState.hasPath ||
    state.canReopenTab !== documentState.canReopenTab;
  documentState = state;
  if (menuChanged) rebuildApplicationMenu();
}

/** Electron fills in the accelerator a role gets by default, so what the native menu bar showed is what the drawn one shows. */
function shortcutOf(item: MenuItem): string | undefined {
  return item.accelerator === null ? undefined : formatShortcut(item.accelerator);
}

/** The setting a native check box stands for; the template carries it through the native item. */
function settingOf(item: MenuItem): BooleanSettingKey | undefined {
  const setting: unknown = "setting" in item ? item.setting : undefined;
  return isBooleanSettingKey(setting) ? setting : undefined;
}

function entriesOf(items: readonly MenuItem[]): MenuEntry[] {
  return items.flatMap((item): MenuEntry[] => {
    // Hidden items only exist to give an accelerator a second spelling
    if (!item.visible) return [];
    if (item.type === "separator") return [{ type: "separator" }];
    const shortcut = shortcutOf(item);
    const setting = settingOf(item);
    const invert: unknown = "invert" in item ? item.invert : undefined;
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
        ...(setting === undefined ? {} : { setting }),
        ...(invert === true ? { invert: true } : {}),
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
