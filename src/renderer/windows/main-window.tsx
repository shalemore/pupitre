import { makeEventListener } from "@solid-primitives/event-listener";
import { debounce, scheduleIdle } from "@solid-primitives/scheduled";
import { CornerRightUp, Eye } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  lazy,
  on,
  onCleanup,
  onMount,
  Show,
  type Component,
} from "solid-js";
import { IMAGE_FILE, type AppCommand } from "@shared/desktop-api";
import { messageOf } from "@shared/errors";
import { isInsideFolder } from "@shared/paths";
import { AppMark } from "@/components/app-mark";
import { TitleBar } from "@/components/title-bar";
import { IconButton, ToggleIconButton } from "@/components/ui";
import { CommandPalette } from "@/features/command-palette/command-palette";
import { FindBar } from "@/features/editor/find-bar";
import { ImagePreview } from "@/features/editor/image-preview";
import type { MarkdownEditorHandle, MatchStats } from "@/features/editor/markdown-editor";
import { TableSizeDialog } from "@/features/editor/table-size-dialog";
import { VersionHistory } from "@/features/history/version-history";
import { MenuBar, MenuButton } from "@/features/menu/menu-bar";
import { QuickOpen } from "@/features/quick-open/quick-open";
import { FolderSortButton } from "@/features/sidebar/folder-sort-button";
import { FolderTree } from "@/features/sidebar/folder-tree";
import { OutlineList } from "@/features/sidebar/outline-list";
import {
  SIDEBAR_WIDTH,
  Sidebar,
  SidebarPanel,
  SidebarSlot,
  type SidebarMode,
} from "@/features/sidebar/sidebar";
import { TabsBar } from "@/features/tabs/tabs-bar";
import { WelcomeScreen } from "@/features/welcome/welcome-screen";
import { WorkspaceSearch } from "@/features/workspace-search/workspace-search";
import { t } from "@/i18n";
import { desktop, isMacOS } from "@/lib/desktop";
import { documentPosition } from "@/lib/document-positions";
import { createDocumentSession } from "@/lib/document-session";
import { reportFailure } from "@/lib/errors";
import { fileNameOf, isolateFileName, parentFolder, withoutDocumentExtension } from "@/lib/file";
import { withoutScripts } from "@/lib/html";
import { createImmersiveChrome } from "@/lib/immersive-chrome";
import { headingKey, type OutlineHeading } from "@/lib/markdown/outline-heading";
import { recentFiles } from "@/lib/recent-files";
import { settings, updateSettings } from "@/lib/settings";
import { quietButton, rtlFlip } from "@/lib/styles";
import type { TextStats } from "@/lib/text-stats";
import { css, cx } from "@/styled-system/css";

type FindMode = "closed" | "find" | "replace";
// A drag reports the pointer for every pixel it moves; only the width it settles on is worth writing
const SIDEBAR_WIDTH_SAVE_DELAY = 300;
/** The outline of a document nothing is folded in yet, and of no document at all. */
const OPEN_SECTIONS: ReadonlySet<string> = new Set();

/** Whether a path names a picture, which the content area shows instead of the editor. */
const isImagePath = (path: string | undefined) => path !== undefined && IMAGE_FILE.test(path);

/** CodeMirror and the editor around it load when a document is shown, not with the welcome screen. */
const MarkdownEditor = lazy(async () => {
  const { MarkdownEditor: Component } = await import("@/features/editor/markdown-editor");
  return { default: Component };
});

const windowFrame = css({
  height: "100vh",
  width: "100vw",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  color: "foreground",
  _print: { display: "block", height: "auto", overflow: "visible" },
});
const windowImmersive = css({ backgroundColor: "surface.0" });
const windowClassic = css({ backgroundColor: "surface.1" });
const titleBar = css({
  overflow: "hidden",
  transitionProperty: "height",
  transitionDuration: "sheet",
  transitionTimingFunction: "outExpo",
});
const titleBarHidden = css({ height: 0 });
const frameBorderBottom = css({
  borderBlockEndWidth: "hairline",
  borderBlockEndStyle: "solid",
  borderBlockEndColor: "border",
});
const frameBorderStart = css({
  borderInlineStartWidth: "hairline",
  borderInlineStartStyle: "solid",
  borderInlineStartColor: "border",
});
const frameBorderEnd = css({
  borderInlineEndWidth: "hairline",
  borderInlineEndStyle: "solid",
  borderInlineEndColor: "border",
});
const titleGrid = css({
  flex: "1",
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)",
  alignItems: "center",
  gap: "2",
});
const titleStart = css({
  display: "flex",
  minWidth: 0,
  alignItems: "center",
  gap: "2",
  overflow: "hidden",
});
const mark = css({ color: "muted.foreground" });
const titleCenter = css({
  minWidth: 0,
  paddingInline: "4",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "2",
  fontWeight: "medium",
  color: "foreground",
});
const dirtyDot = css({
  width: "1.5",
  height: "1.5",
  flexShrink: 0,
  borderRadius: "full",
  backgroundColor: "brand",
  animationName: "zoomIn",
  animationDuration: "snap",
  animationTimingFunction: "outExpo",
});
const ellipsis = css({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
const titleEnd = css({
  display: "flex",
  minWidth: 0,
  alignItems: "center",
  justifyContent: "flex-end",
  overflow: "hidden",
});
const content = css({
  flex: "1",
  minHeight: 0,
  display: "flex",
  overflow: "hidden",
  _print: { display: "block", overflow: "visible" },
});
const contentGap = css({
  gap: "var(--pref-immersive-gap)",
  paddingBlock: "var(--pref-immersive-gap)",
  paddingInlineStart: 0,
  _print: { padding: 0 },
});
const contentEnd = css({ paddingInlineEnd: "var(--pref-immersive-gap)" });
const contentEndSplit = css({ paddingInlineEnd: 0 });
const card = css({
  flex: "1",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  _print: { display: "block", overflow: "visible" },
});
const cardImmersive = css({
  borderRadius: "lg",
  backgroundColor: "surface.1",
  boxShadow: "sm",
  _print: { borderRadius: 0, boxShadow: "none" },
});
const documentArea = css({
  flex: "1",
  minHeight: 0,
  display: "flex",
  overflow: "hidden",
  _print: { display: "block", overflow: "visible" },
});
const grow = css({ flex: "1" });
const editorArea = css({
  flex: "1",
  height: "full",
  overflow: "hidden",
  position: "relative",
  _print: { height: "auto", overflow: "visible" },
});
const wordCountLabel = css({
  textStyle: "2xs",
  color: "muted.foreground",
  fontVariantNumeric: "tabular-nums",
  display: "flex",
  flexShrink: 0,
  alignItems: "center",
  gap: "1.5",
  whiteSpace: "nowrap",
  marginInlineEnd: "2",
});

export const MainWindow: Component = () => {
  // A signal rather than a variable: a new document brings a new editor, and a match found in the
  // folder waits for that editor before it selects itself
  const [editor, setEditor] = createSignal<MarkdownEditorHandle>();
  const session = createDocumentSession(() => editor());
  /** The active tab shows a picture, not text: the commands that work on text have nothing to do. */
  const activeIsImage = () => isImagePath(session.activeDocument()?.path);
  const [outline, setOutline] = createSignal<OutlineHeading[]>([]);
  const [activeHeading, setActiveHeading] = createSignal(-1);
  const [stats, setStats] = createSignal<TextStats>({ words: 0, characters: 0, cjk: 0 });
  // A page written mostly in Han or kana counts its characters one by one, the way Word counts
  // Chinese; a page of words counts the words between spaces. The CJK count says which of the two
  // a document follows, and the dictionary names the number after that, whatever the interface
  // language is
  const countKind = (): "word" | "character" =>
    stats().cjk * 2 >= stats().words ? "character" : "word";
  // A selection is counted before the document totals, as "12 words / 300 words"; the dictionary
  // decides the order and the separator
  const wordsText = createMemo(() => {
    const { words, selectedWords } = stats();
    const total = t().common.wordsCount(words, countKind());
    return selectedWords === undefined
      ? total
      : t().common.selectedOfTotal(t().common.wordsCount(selectedWords, countKind()), total);
  });
  const charsText = createMemo(() => {
    const { characters, selectedCharacters } = stats();
    const total = t().common.charsCount(characters);
    return selectedCharacters === undefined
      ? total
      : t().common.selectedOfTotal(t().common.charsCount(selectedCharacters), total);
  });
  // The count ends the bar in either layout: beside the tabs, or at the end of the title's grid
  const wordCount = () => (
    <Show
      when={session.activeDocument() !== undefined && !activeIsImage() && settings().showWordCount}
    >
      <div
        data-bar-part="count"
        // The character count is a second reading of a dense page; a page of words needs only
        // the words beside them, and shows both counts when pointed at
        title={`${wordsText()} · ${charsText()}`}
        class={wordCountLabel}
      >
        <span>{wordsText()}</span>
        <Show when={countKind() === "character"}>
          <span>·</span>
          <span>{charsText()}</span>
        </Show>
      </div>
    </Show>
  );
  // The folder the user opened or dropped. It is remembered for the next run; a document from
  // outside it shows its own folder without replacing it
  const [openedFolder, setOpenedFolder] = createSignal<string | undefined>(
    desktop.initialState.folder,
  );
  // A folder just opened on purpose, shown even while a document outside it stays on show
  const [folderView, setFolderView] = createSignal<string>();
  const [preferredMode, setPreferredMode] = createSignal<SidebarMode>("outline");
  const [findMode, setFindMode] = createSignal<FindMode>("closed");
  const [paletteOpen, setPaletteOpen] = createSignal(false);
  const [historyOpen, setHistoryOpen] = createSignal(false);
  const [quickOpenOpen, setQuickOpenOpen] = createSignal(false);
  const [workspaceSearchOpen, setWorkspaceSearchOpen] = createSignal(false);
  const [tableSizeOpen, setTableSizeOpen] = createSignal(false);
  // A match to select once the editor holds the document it was found in
  const [matchToReveal, setMatchToReveal] = createSignal<
    { path: string; from: number; to: number } | undefined
  >();
  const [initialSearch, setInitialSearch] = createSignal("");
  const [matchStats, setMatchStats] = createSignal<MatchStats>({ current: 0, total: 0 });
  // The outline sections the user folded, by headingKey, each document with its own: a fold belongs
  // to the document it was made in and survives every edit of it
  const [foldedSections, setFoldedSections] = createSignal<
    ReadonlyMap<number, ReadonlySet<string>>
  >(new Map());
  const [menuOpen, setMenuOpen] = createSignal(false);
  // A menu or the rename field in the start sidebar keeps that sidebar (and the chrome) open
  const [startSidebarHeld, setStartSidebarHeld] = createSignal(false);
  // Whether a level on show in the folder holds an entry the eye can reveal
  const [folderHasHidden, setFolderHasHidden] = createSignal(false);
  const immersive = () => settings().windowStyle === "immersive";
  // The strip takes the title bar's place with several documents, and with one when the user asks
  // for it. With tabs off it only appears while documents are left over from turning the setting
  // off, so they stay reachable until they are closed
  const tabBarShown = () =>
    session.tabs().length > 1 ||
    (settings().tabs && !settings().hideSingleTab && session.tabs().length === 1);
  // Split, the folder has its own sidebar at the start edge and the outline one at the end edge; combined, one sidebar shows either
  const split = () => settings().sidebarLayout === "split";
  // A sidebar keeps the width the user dragged it to in an earlier run
  const savedWidths = desktop.initialState.sidebarWidths;
  const [startWidth, setStartWidth] = createSignal(savedWidths?.start ?? SIDEBAR_WIDTH.initial);
  const [endWidth, setEndWidth] = createSignal(savedWidths?.end ?? SIDEBAR_WIDTH.initial);
  const saveWidthsSoon = debounce(
    (start: number, end: number) =>
      void desktop.invoke("window:set-sidebar-widths", { start, end }),
    SIDEBAR_WIDTH_SAVE_DELAY,
  );
  createEffect(
    on([startWidth, endWidth], ([start, end]) => saveWidthsSoon(start, end), { defer: true }),
  );

  // A folder the user opened shows at once, whatever document is open; while none is open the
  // sidebar keeps the folder it already shows, so opening a document further down the tree does not
  // descend into the folder that document sits in. A document from outside the folder shows the
  // folder that holds it for as long as it is active, and the opened folder stays remembered.
  const folderRoot = createMemo(() => {
    const viewed = folderView();
    if (viewed !== undefined) return viewed;
    const opened = openedFolder();
    const doc = session.activeDocument();
    if (opened === undefined) return doc?.folder;
    if (doc?.path !== undefined && !isInsideFolder(opened, doc.path)) return doc.folder;
    return opened;
  });
  // Choosing another document hands the sidebar back to that document's folder
  createEffect(
    on(
      () => session.activeDocument()?.id,
      () => setFolderView(undefined),
      { defer: true },
    ),
  );
  createEffect(
    on(
      openedFolder,
      (folder) => {
        if (folder !== undefined) void desktop.invoke("window:set-folder", folder);
      },
      { defer: true },
    ),
  );
  // The folder in the sidebar is the one whose own settings file, if it has one, applies
  createEffect(() => void desktop.invoke("workspace:set", folderRoot() ?? null));
  // What the layout has to show at all; an immersive window folds a sidebar on top of that
  const startSidebarWanted = () =>
    settings().sidebarVisible &&
    (split()
      ? folderRoot() !== undefined
      : session.activeDocument() !== undefined || folderRoot() !== undefined);
  const endSidebarWanted = () =>
    split() && settings().sidebarVisible && session.activeDocument() !== undefined;
  const chrome = createImmersiveChrome({
    immersive,
    canFold: () => immersive() && session.activeDocument() !== undefined,
    // In a classic window the same value means the sidebar is collapsed, so it is "open" when unset
    startPinned: () =>
      (immersive() ? settings().sidebarPinnedStart : !settings().sidebarPinnedStart) ||
      startSidebarHeld(),
    endPinned: () => (immersive() ? settings().sidebarPinnedEnd : !settings().sidebarPinnedEnd),
    titleBarPinned: menuOpen,
    startRoom: () => (startSidebarWanted() ? startWidth() : 0),
    endRoom: () => (endSidebarWanted() ? endWidth() : 0),
  });
  let contentArea: HTMLDivElement | undefined;
  // A menu pick is an interaction with the chrome; it stays unfolded until the pointer moves again,
  // rather than folding under the pointer that is still where the picked entry was
  createEffect(
    on(
      menuOpen,
      (open) => {
        if (!open) chrome.keepVisible();
      },
      { defer: true },
    ),
  );
  createEffect(
    on(
      startSidebarHeld,
      (held) => {
        if (!held) chrome.keepVisible();
      },
      { defer: true },
    ),
  );
  // Turning tabs off returns the window to one document. The others close after the usual save
  // prompt, and a cancel keeps tabs on: there would be no strip to reach the tab it kept.
  createEffect(
    on(
      () => settings().tabs,
      (tabs) => {
        if (tabs) return;
        void session.closeOtherTabs().then((closed) => {
          if (!closed) void updateSettings({ tabs: true });
        });
      },
      { defer: true },
    ),
  );
  // An immersive window pins a sidebar open; a classic one uses the same value to keep it collapsed
  const onStartPinnedChange = () => (sidebarPinnedStart: boolean) => {
    void updateSettings({ sidebarPinnedStart });
    // A classic sidebar folds at once rather than waiting for the pointer to leave the sidebar it
    // is still over; the edge brings it back when the pointer asks for it
    if (!immersive() && sidebarPinnedStart) chrome.hide();
  };
  const onEndPinnedChange = () => (sidebarPinnedEnd: boolean) => {
    void updateSettings({ sidebarPinnedEnd });
    if (!immersive() && sidebarPinnedEnd) chrome.hide();
  };
  const startSidebarShown = () => startSidebarWanted() && chrome.sidebarVisible();
  const endSidebarShown = () => endSidebarWanted() && chrome.endSidebarVisible();
  const sidebarMode = (): SidebarMode => {
    if (session.activeDocument() === undefined) return "folder";
    return folderRoot() === undefined ? "outline" : preferredMode();
  };

  const foldedHeadings = () => {
    const id = session.activeDocument()?.id;
    return id === undefined ? OPEN_SECTIONS : (foldedSections().get(id) ?? OPEN_SECTIONS);
  };

  const toggleOutlineSection = (heading: OutlineHeading) => {
    const id = session.activeDocument()?.id;
    if (id === undefined) return;
    const key = headingKey(heading);
    setFoldedSections((current) => {
      const keys = new Set(current.get(id));
      if (!keys.delete(key)) keys.add(key);
      return new Map(current).set(id, keys);
    });
  };

  const outlineList = () => (
    <OutlineList
      headings={outline()}
      activeIndex={activeHeading()}
      collapsed={foldedHeadings()}
      onToggleCollapsed={toggleOutlineSection}
      onSelectHeading={(heading) => editor()?.scrollTo(heading.pos)}
    />
  );
  const folderTree = (root: string) => (
    <FolderTree
      root={root}
      activePath={session.activeDocument()?.path}
      onOpenFile={(path) => session.openPath(path, false)}
      onOpenFolder={showFolder}
      onPathChanged={(oldPath, newPath) => {
        // A renamed folder keeps the sidebar showing it, and a renamed document keeps its editor
        if (openedFolder() === oldPath) setOpenedFolder(newPath);
        if (folderView() === oldPath) setFolderView(newPath);
        void session.handleRename(oldPath, newPath);
      }}
      onHoldOpenChange={setStartSidebarHeld}
      onHiddenChange={setFolderHasHidden}
    />
  );

  // A picture has no editor, so the handle the commands would use has to go with the editor
  createEffect(() => {
    if (activeIsImage()) setEditor(undefined);
  });

  createEffect(() => {
    document.title = session.activeDocument()
      ? `${isolateFileName(session.fileName())} - Pupitre`
      : "Pupitre";
  });
  createEffect(() => {
    void desktop.invoke("window:set-document-state", {
      hasDocument: session.activeDocument() !== undefined,
      hasText: session.activeDocument() !== undefined && !activeIsImage(),
      hasPath: session.activeDocument()?.path !== undefined,
      isDirty: session.hasDirtyTabs(),
      canReopenTab: session.canReopenTab(),
    });
  });
  // Close the find bar and the version history when the document changes: the old document's
  // matches and versions mean nothing to the one that replaced it
  createEffect(
    on(
      () => session.activeDocument()?.id,
      (id, previous) => {
        // A tab patch, such as a keystroke or a save, rebuilds the tabs array without changing the
        // document; only another document is a reason to close these and unfold the chrome
        if (id === previous) return;
        setFindMode("closed");
        setHistoryOpen(false);
        // A picture has no outline, counts or heading; the editor fills these in again when it
        // shows the text of the next document
        setOutline([]);
        setActiveHeading(-1);
        setStats({ words: 0, characters: 0, cjk: 0 });
        chrome.show();
      },
    ),
  );

  // The editor of a document is built after the document changed, so the match waits for the
  // handle of the new editor rather than for the document: revealing it on the one that is being
  // torn down would leave the new one at its remembered place instead of at the match
  createEffect(
    on(editor, (handle) => {
      const match = matchToReveal();
      if (handle === undefined || match === undefined) return;
      if (session.activeDocument()?.path !== match.path) return;
      setMatchToReveal(undefined);
      handle.revealRange(match.from, match.to);
    }),
  );

  const closeWorkspaceSearch = () => {
    setWorkspaceSearchOpen(false);
    editor()?.focus();
  };

  const openWorkspaceMatch = async (path: string, from: number, to: number) => {
    setWorkspaceSearchOpen(false);
    setMatchToReveal({ path, from, to });
    await session.openPath(path, false);
    // The file could not be read, so the match has nowhere to appear
    if (session.activeDocument()?.path !== path) setMatchToReveal(undefined);
  };

  const openFind = (mode: Exclude<FindMode, "closed">) => {
    if (!session.activeDocument() || editor() === undefined) return;
    setInitialSearch(editor()?.getSelectedText().trim() ?? "");
    setFindMode(mode);
  };

  const closeFind = () => {
    setFindMode("closed");
    editor()?.setSearch({
      search: "",
      replace: "",
      caseSensitive: false,
      wholeWord: false,
      regexp: false,
    });
    editor()?.focus();
  };

  const runSearch = (action: (handle: MarkdownEditorHandle) => MatchStats) => {
    const handle = editor();
    if (handle) setMatchStats(action(handle));
  };

  const showFolder = (path: string) => {
    setOpenedFolder(path);
    setFolderView(path);
    setPreferredMode("folder");
    if (!settings().sidebarVisible) void updateSettings({ sidebarVisible: true });
  };

  const parentOfFolder = createMemo(() => {
    const root = folderRoot();
    return root === undefined ? undefined : parentFolder(root);
  });

  /** The button up to the folder that holds the one on show, right beside its name. */
  const parentAction = () => (
    <Show when={desktop.initialState.capabilities.folderParent && parentOfFolder()}>
      <IconButton
        label={t().sidebar.parentFolder}
        size="icon-2xs"
        class={quietButton}
        onClick={() => {
          const parent = parentOfFolder();
          if (parent !== undefined) showFolder(parent);
        }}
      >
        <CornerRightUp class={rtlFlip} />
      </IconButton>
    </Show>
  );

  /** The folder's order menu, at the far end of the title row. */
  const folderAction = () => (
    <>
      <Show when={folderHasHidden()}>
        <ToggleIconButton
          pressed={settings().showHidden}
          onChange={(showHidden) => void updateSettings({ showHidden })}
          label={t().settings.showHidden}
          size="icon-2xs"
          class={quietButton}
        >
          <Eye />
        </ToggleIconButton>
      </Show>
      <FolderSortButton onHoldOpenChange={setStartSidebarHeld} />
    </>
  );

  const openFolder = async () => {
    const path = await desktop.invoke("folder:choose");
    if (path !== null) showFolder(path);
  };

  /** Runs `run` with the whole document rendered, which printing and exporting need, and puts it back. */
  const whilePrinting = async (run: () => Promise<unknown>) => {
    const resume = await editor()?.prepareForPrint();
    try {
      await run();
    } finally {
      resume?.();
    }
  };

  const exportPdf = async () => {
    if (!session.activeDocument() || activeIsImage()) return;
    const pdfName = withoutDocumentExtension(session.fileName()) + ".pdf";
    await whilePrinting(() => desktop.invoke("document:export-pdf", pdfName));
  };

  const printDocument = async () => {
    if (activeIsImage()) return;
    await whilePrinting(() => desktop.invoke("document:print"));
  };

  /** Writes the document as the page the editor would show, as a web page or as one tall image. */
  const exportDocument = async (format: "html" | "image") => {
    const doc = session.activeDocument();
    if (!doc) return;
    const html = await editor()?.toHtml();
    if (html === undefined) return;
    const name =
      withoutDocumentExtension(session.fileName()) + (format === "html" ? ".html" : ".png");
    try {
      await (format === "html"
        ? desktop.invoke("document:export-html", name, html)
        : desktop.invoke("document:export-image", name, withoutScripts(html), doc.folder));
    } catch (error) {
      await reportFailure(t().dialogs.saveFailed, name, messageOf(error));
    }
  };

  /** Inserts the clipboard's text where it is being typed, leaving its formatting behind. */
  const pastePlainText = async () => {
    // A browser can refuse the clipboard read; there is nothing to insert then
    const text = await desktop.invoke("clipboard:read-text").catch(() => "");
    if (text === "") return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      const start = active.selectionStart ?? active.value.length;
      const end = active.selectionEnd ?? start;
      active.setRangeText(text, start, end, "end");
      active.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    editor()?.pastePlainText(text);
  };

  /** Puts the selection, or the whole document when nothing is selected, on the clipboard as rich text. */
  const copyAsHtml = async () => {
    const fragment = await editor()?.toHtmlFragment();
    if (fragment === undefined) return;
    await desktop.invoke("clipboard:write-rich", fragment.markdown, fragment.html);
  };

  /** Puts the caret back where the table would go, for a size dialog that was not answered. */
  const closeTableSize = () => {
    setTableSizeOpen(false);
    editor()?.focus();
  };

  const insertTable = (rows: number, columns: number) => {
    setTableSizeOpen(false);
    editor()?.insertTable(rows, columns);
  };

  /** Asks about every tab with unsaved changes, then lets the window go. */
  const closeWindow = async () => {
    if (!(await session.confirmDiscard())) return;
    void desktop.invoke("window:close-confirmed");
  };

  /** Closes the tab being shown; the last one closes the window. */
  const closeActiveTab = async () => {
    const tab = session.activeTab();
    if (tab === undefined) return;
    if (session.tabs().length > 1) return session.closeTab(tab.id);
    await closeWindow();
  };

  const runCommand = (command: AppCommand) => {
    switch (command.id) {
      case "file.new":
        return session.newDocument();
      case "file.open":
        return void session.open();
      case "file.open-folder":
        return void openFolder();
      case "file.quick-open":
        return setQuickOpenOpen(true);
      case "file.open-path":
        return void session.openPath(command.path);
      case "file.save":
        return void session.save();
      case "file.save-as":
        return void session.saveAs();
      case "file.close-tab":
        return void closeActiveTab();
      case "file.reopen-tab":
        return void session.reopenTab();
      case "file.print":
        return void printDocument();
      case "file.export-pdf":
        return void exportPdf();
      case "file.export-html":
        return void exportDocument("html");
      case "file.export-image":
        return void exportDocument("image");
      case "file.version-history":
        return setHistoryOpen(true);
      case "edit.find":
        return openFind("find");
      case "edit.replace":
        return openFind("replace");
      case "edit.copy-html":
        return void copyAsHtml();
      case "edit.paste-plain":
        return void pastePlainText();
      case "edit.insert-image":
        return void editor()?.insertImage();
      case "edit.insert-table":
        return setTableSizeOpen(true);
      case "edit.search-workspace":
        return setWorkspaceSearchOpen(true);
      case "view.toggle-sidebar":
        return void updateSettings({ sidebarVisible: !settings().sidebarVisible });
      case "view.command-palette":
        return setPaletteOpen(true);
      case "view.next-tab":
        return session.nextTab();
      case "view.previous-tab":
        return session.previousTab();
      case "help.sample-document":
        return session.openSample();
      case "format":
        return editor()?.format(command.action);
      case "window.close":
        return void closeWindow();
    }
  };

  onMount(() => {
    // Capture, so the wheel that folds the chrome does not also scroll the document under it
    const area = contentArea;
    if (area !== undefined) {
      const onWheel = (event: WheelEvent) => {
        if (!chrome.onWheel(event)) return;
        event.preventDefault();
        event.stopPropagation();
      };
      makeEventListener(area, "wheel", onWheel, { capture: true, passive: false });
    }
    void session.restoreOnStartup();
    // The editor is a chunk of its own; fetch it while the welcome screen is idle, so the first
    // document does not wait for both the file and the code that shows it
    const warmEditor = () => void import("@/features/editor/markdown-editor");
    scheduleIdle(warmEditor, 2000)();
    // A window that closes before the next write of the draft was due keeps the last typing all the same
    makeEventListener(window, "pagehide", session.flushDraft);
    // dragover's default behavior must be prevented, otherwise drop never fires
    makeEventListener(window, "dragover", (e) => e.preventDefault());
    makeEventListener(window, "drop", (e) => {
      const file = e.dataTransfer?.files[0];
      if (file && e.dataTransfer?.items[0]?.webkitGetAsEntry()?.isDirectory) {
        e.preventDefault();
        showFolder(desktop.getPathForFile(file));
        return;
      }
      // Images dropped into the editor are handled by the editor; this only takes over Markdown files dropped on the window
      if (!file || file.type.startsWith("image/")) return;
      e.preventDefault();
      void session.openPath(desktop.getPathForFile(file));
    });
    const unlistenCommands = desktop.on("app:command", runCommand);

    onCleanup(() => {
      session.dispose();
      unlistenCommands();
    });
  });

  return (
    <div
      data-window-style={settings().windowStyle}
      onPointerMove={(event) => chrome.onPointerMove(event)}
      class={cx(windowFrame, immersive() ? windowImmersive : windowClassic)}
    >
      {/* Folding the title bar away animates its height, and the card moves up into the room */}
      <TitleBar
        inert={!chrome.titleBarVisible()}
        class={cx(
          titleBar,
          !chrome.titleBarVisible() && titleBarHidden,
          !immersive() && frameBorderBottom,
        )}
      >
        <Show
          when={tabBarShown()}
          fallback={
            // Equal side columns keep the document name in the middle of the bar, whatever the
            // menus and the count take
            <div data-title-grid class={titleGrid}>
              <div class={titleStart}>
                <AppMark class={mark} />
                <Show when={!isMacOS}>
                  <MenuBar onOpenChange={setMenuOpen} />
                </Show>
              </div>

              <div class={titleCenter}>
                <Show when={session.activeDocument()}>
                  <Show when={session.isDirty()}>
                    <span aria-hidden="true" class={dirtyDot} />
                  </Show>
                  <bdi dir="ltr" class={ellipsis}>
                    {session.fileName()}
                  </bdi>
                </Show>
              </div>

              <div class={titleEnd}>{wordCount()}</div>
            </div>
          }
        >
          {/* With several documents the bar holds the tabs; the menus fold into one button so the
              strip does not sit under a bar that unfolds as the pointer reaches for it */}
          <Show when={!isMacOS}>
            <MenuButton onOpenChange={setMenuOpen} />
          </Show>
          <TabsBar
            tabs={session.tabs()}
            activeId={session.activeTab()?.id}
            nameOf={session.tabFileName}
            onActivate={session.activateTab}
            onClose={(id) => void session.closeTab(id)}
          />
        </Show>

        <Show when={tabBarShown()}>{wordCount()}</Show>
      </TitleBar>

      <div
        ref={(element) => (contentArea = element)}
        onKeyDown={(event) => {
          if (!event.ctrlKey && !event.metaKey && !event.altKey) chrome.hide();
        }}
        class={cx(
          content,
          // The card keeps an even gap to the window edges, the title bar and the sidebars
          immersive() && cx(contentGap, split() ? contentEndSplit : contentEnd),
        )}
      >
        <SidebarSlot
          side="start"
          shown={startSidebarShown()}
          width={startWidth()}
          onWidthChange={setStartWidth}
        >
          <Show
            when={split()}
            fallback={
              <Sidebar
                class={cx(!immersive() && frameBorderEnd)}
                mode={sidebarMode()}
                pinned={settings().sidebarPinnedStart}
                onPinnedChange={onStartPinnedChange()}
                collapsing={!immersive()}
                hasOutline={session.activeDocument() !== undefined}
                hasFolder={folderRoot() !== undefined}
                folderName={fileNameOf(folderRoot() ?? "")}
                folderTitleAction={parentAction()}
                folderAction={folderAction()}
                onModeChange={setPreferredMode}
                outline={outlineList()}
                folder={
                  <Show when={folderRoot()} keyed>
                    {folderTree}
                  </Show>
                }
              />
            }
          >
            <Show when={folderRoot()} keyed>
              {(root) => (
                <SidebarPanel
                  side="start"
                  title={fileNameOf(root)}
                  titleAction={parentAction()}
                  action={folderAction()}
                  pinned={settings().sidebarPinnedStart}
                  onPinnedChange={onStartPinnedChange()}
                  collapsing={!immersive()}
                  class={cx(!immersive() && frameBorderEnd)}
                >
                  {folderTree(root)}
                </SidebarPanel>
              )}
            </Show>
          </Show>
        </SidebarSlot>

        {/* An immersive window shows the document as a card on the window background, which also holds the title bar and the sidebar */}
        <div class={cx(card, immersive() && cardImmersive)}>
          <div class={documentArea}>
            <Show
              when={session.activeTab()}
              fallback={
                <main class={grow}>
                  <WelcomeScreen
                    recentFiles={recentFiles()}
                    onNewDocument={session.newDocument}
                    onOpenFile={session.open}
                    onOpenRecent={session.openPath}
                  />
                </main>
              }
            >
              {(tab) => (
                <main class={editorArea}>
                  <Show when={findMode() !== "closed"}>
                    <FindBar
                      showReplace={findMode() === "replace"}
                      initialSearch={initialSearch()}
                      matchStats={matchStats()}
                      onToggleReplace={() =>
                        setFindMode(findMode() === "replace" ? "find" : "replace")
                      }
                      onClose={closeFind}
                      onSearchChange={(options) => runSearch((handle) => handle.setSearch(options))}
                      onFindNext={() => runSearch((handle) => handle.findNext())}
                      onFindPrevious={() => runSearch((handle) => handle.findPrevious())}
                      onReplaceNext={() => runSearch((handle) => handle.replaceNext())}
                      onReplaceAll={() => runSearch((handle) => handle.replaceAll())}
                    />
                  </Show>

                  {/* Rebuild the editor per document id, which is a new one for every tab and every reload; Save As only changes the path, so the editor and its undo history stay */}
                  <Show when={tab().doc.id} keyed>
                    <Show
                      when={isImagePath(tab().doc.path)}
                      fallback={
                        <MarkdownEditor
                          markdown={tab().markdown}
                          initialPosition={documentPosition(tab().doc.path)}
                          baseUrl={tab().doc.baseUrl}
                          documentPath={tab().doc.path}
                          pendingImages={tab().pendingImages}
                          onReady={session.handleEditorReady}
                          onMarkdownChange={session.handleMarkdownChange}
                          onOutlineChange={setOutline}
                          onActiveHeadingChange={setActiveHeading}
                          onStatsChange={setStats}
                          onMatchStatsChange={setMatchStats}
                          ref={setEditor}
                        />
                      }
                    >
                      <ImagePreview baseUrl={tab().doc.baseUrl} path={tab().doc.path} />
                    </Show>
                  </Show>
                </main>
              )}
            </Show>
          </div>
        </div>

        <Show when={split()}>
          <SidebarSlot
            side="end"
            shown={endSidebarShown()}
            width={endWidth()}
            onWidthChange={setEndWidth}
          >
            <SidebarPanel
              side="end"
              title={t().sidebar.outline}
              pinned={settings().sidebarPinnedEnd}
              onPinnedChange={onEndPinnedChange()}
              collapsing={!immersive()}
              class={cx(!immersive() && frameBorderStart)}
            >
              {outlineList()}
            </SidebarPanel>
          </SidebarSlot>
        </Show>
      </div>

      <Show when={paletteOpen()}>
        <CommandPalette onClose={() => setPaletteOpen(false)} />
      </Show>

      <Show when={tableSizeOpen()}>
        <TableSizeDialog onInsert={insertTable} onClose={closeTableSize} />
      </Show>

      {/* The versions belong to a file, so a document that has none has no panel to offer */}
      <Show when={historyOpen() && session.activeDocument()?.path}>
        {(path) => (
          <VersionHistory
            path={path()}
            onRestore={(markdown) => editor()?.replaceDocument(markdown)}
            onClose={() => setHistoryOpen(false)}
          />
        )}
      </Show>

      <Show when={quickOpenOpen()}>
        <QuickOpen
          root={folderRoot()}
          onClose={() => setQuickOpenOpen(false)}
          onOpen={(path) => void session.openPath(path)}
        />
      </Show>

      <Show when={workspaceSearchOpen()}>
        <WorkspaceSearch
          root={folderRoot()}
          onOpenMatch={(path, from, to) => void openWorkspaceMatch(path, from, to)}
          onClose={closeWorkspaceSearch}
        />
      </Show>
    </div>
  );
};
