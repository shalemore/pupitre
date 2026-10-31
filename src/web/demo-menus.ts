import type { AppCommand, DocumentState } from "@shared/desktop-api";
import {
  INLINE_FORMAT_ACTIONS,
  PARAGRAPH_MENU_GROUPS,
  shortcutOf,
  type FormatAction,
} from "@shared/format-actions";
import type { TranslationSchema } from "@shared/i18n";
import {
  formatShortcut,
  type MenuEntry,
  type Menus,
  menusOf,
  type TopMenu,
  withGroupSeparators,
} from "@shared/menu";
import type { Settings } from "@shared/settings";

/**
 * The demo's menu, described the way the app's main process describes its own. The page draws the
 * bar itself, so the demo lists what each menu holds and keeps what each entry runs, by id.
 */

export interface DemoMenuSource {
  labels: () => TranslationSchema;
  documentState: () => DocumentState;
  dispatch: (command: AppCommand) => void;
  openSettings: () => void;
  settings: () => Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

export function createDemoMenus(source: DemoMenuSource) {
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
  let runs = new Map<string, () => void>();

  function menuItems(menu: TopMenu): DemoMenuEntry[] {
    const { menu: m, format } = source.labels();
    const { hasDocument, hasPath, canReopenTab } = source.documentState();
    // A document without a file has no versions kept of it
    const hasFile = hasDocument && hasPath;
    const send = (command: AppCommand) => () => source.dispatch(command);
    const formatItems = (actions: readonly FormatAction[]): DemoMenuEntry[] =>
      actions.map((action) => {
        const shortcut = shortcutOf(action);
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
          { label: m.preferences, run: () => source.openSettings() },
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
            checked: source.settings().sourceMode,
            run: () => source.updateSettings({ sourceMode: !source.settings().sourceMode }),
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
            checked: source.settings().focusMode,
            run: () => source.updateSettings({ focusMode: !source.settings().focusMode }),
          },
          {
            label: m.typewriterMode,
            shortcut: "F9",
            checked: source.settings().typewriterMode,
            run: () => source.updateSettings({ typewriterMode: !source.settings().typewriterMode }),
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
      if (entry.run !== undefined) runs.set(id, entry.run);
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

  const snapshot = (): Menus => {
    runs = new Map();
    return menusOf((menu) => menuEntries(menuItems(menu), menu));
  };

  const click = (itemId: string): void => {
    runs.get(itemId)?.();
  };

  return { click, snapshot };
}
