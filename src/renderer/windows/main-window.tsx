import { makeEventListener } from "@solid-primitives/event-listener";
import { scheduleIdle } from "@solid-primitives/scheduled";
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
import { isInsideFolder } from "@shared/paths";
import { TitleBar } from "@/components/title-bar";
import { IconButton, ToggleIconButton } from "@/components/ui";
import { FindBar } from "@/features/editor/find-bar";
import { ImagePreview } from "@/features/editor/images/image-preview";
import type { MarkdownEditorHandle } from "@/features/editor/markdown-editor";
import type { MatchStats } from "@/features/editor/search";
import { MenuBar, MenuButton } from "@/features/menu-bar";
import { FolderSortButton } from "@/features/sidebar/folder-sort-button";
import { FolderTree } from "@/features/sidebar/folder-tree";
import { OutlineList } from "@/features/sidebar/outline-list";
import type { SidebarMode } from "@/features/sidebar/sidebar";
import { createSidebarControl } from "@/features/sidebar/sidebar-control";
import { TabsBar } from "@/features/tabs-bar";
import { WelcomeScreen } from "@/features/welcome/welcome-screen";
import { t } from "@/i18n";
import { desktop, isMacOS } from "@/lib/desktop";
import { documentPosition } from "@/lib/document/positions";
import { createDocumentSession } from "@/lib/document/session";
import { isolateFileName, parentFolder } from "@/lib/file";
import { createImmersiveChrome } from "@/lib/immersive-chrome";
import { headingKey, type OutlineHeading } from "@/lib/markdown/outline-heading";
import { recentFiles } from "@/lib/recent-files";
import { isImmersive, settings, updateSettings } from "@/lib/settings";
import { quietButton, rtlFlip } from "@/lib/styles";
import type { TextStats } from "@/lib/text-stats";
import { createDocumentActions } from "./document-actions";
import {
  card,
  content,
  dirtyDot,
  documentArea,
  editorArea,
  ellipsis,
  grow,
  titleCenter,
  titleEnd,
  titleGrid,
  titleStart,
} from "./main-window-styles";
import { Overlays, type Overlay } from "./main-window/overlays";
import { SidebarRegion } from "./main-window/sidebar-region";
import { createSidebarWidths } from "./main-window/sidebar-widths";
import { WordCount } from "./main-window/word-count";
import { barDivider, windowFrame } from "./window-chrome";

type FindMode = "closed" | "find" | "replace";
/** The outline of a document nothing is folded in yet, and of no document at all. */
const OPEN_SECTIONS: ReadonlySet<string> = new Set();

/** Whether a path names a picture, which the content area shows instead of the editor. */
const isImagePath = (path: string | undefined) => path !== undefined && IMAGE_FILE.test(path);

/** CodeMirror and the editor around it load when a document is shown, not with the welcome screen. */
const MarkdownEditor = lazy(async () => {
  const { MarkdownEditor: Component } = await import("@/features/editor/markdown-editor");
  return { default: Component };
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
  // The count ends the bar in either layout: beside the tabs, or at the end of the title's grid
  const wordCount = () => (
    <Show
      when={session.activeDocument() !== undefined && !activeIsImage() && settings().showWordCount}
    >
      <WordCount stats={stats()} />
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
  const [overlay, setOverlay] = createSignal<Overlay>();
  const closeOverlay = () => setOverlay(undefined);
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
  // The strip takes the title bar's place with several documents, and with one when the user asks
  // for it. With tabs off it only appears while documents are left over from turning the setting
  // off, so they stay reachable until they are closed
  const tabBarShown = () =>
    session.tabs().length > 1 ||
    (settings().tabs && !settings().hideSingleTab && session.tabs().length === 1);
  // Split, the folder has its own sidebar at the start edge and the outline one at the end edge; combined, one sidebar shows either
  const split = () => settings().sidebarLayout === "split";
  // A sidebar keeps the width the user dragged it to in an earlier run
  const {
    start: startWidth,
    end: endWidth,
    setStart: setStartWidth,
    setEnd: setEndWidth,
  } = createSidebarWidths(desktop.initialState.sidebarWidths);

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
  const startControl = createSidebarControl("start", isImmersive, () => chrome.hide());
  const endControl = createSidebarControl("end", isImmersive, () => chrome.hide());
  const chrome = createImmersiveChrome({
    immersive: isImmersive,
    canFold: () => isImmersive() && session.activeDocument() !== undefined,
    startPinned: () => startControl.open() || startSidebarHeld(),
    endPinned: () => endControl.open(),
    titleBarPinned: menuOpen,
    startWanted: startSidebarWanted,
    endWanted: endSidebarWanted,
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
        if (overlay()?.kind === "history") closeOverlay();
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
    closeOverlay();
    editor()?.focus();
  };

  const openWorkspaceMatch = async (path: string, from: number, to: number) => {
    closeOverlay();
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

  const { copyAsHtml, exportDocument, exportPdf, pastePlainText, printDocument } =
    createDocumentActions(session, editor, activeIsImage);

  /** Puts the caret back where the table would go, for a size dialog that was not answered. */
  const closeTableSize = () => {
    closeOverlay();
    editor()?.focus();
  };

  const insertTable = (rows: number, columns: number) => {
    closeOverlay();
    editor()?.insertTable(rows, columns);
  };

  const openPalette = () => setOverlay({ kind: "palette", onClose: closeOverlay });

  const openTableSize = () =>
    setOverlay({ kind: "table-size", onInsert: insertTable, onClose: closeTableSize });

  // The versions belong to a file, so a document that has none has no panel to offer
  const openHistory = () => {
    const path = session.activeDocument()?.path;
    if (path === undefined) return;
    setOverlay({
      kind: "history",
      path,
      onRestore: (markdown) => editor()?.replaceDocument(markdown),
      onClose: closeOverlay,
    });
  };

  const openQuickOpen = () =>
    setOverlay({
      kind: "quick-open",
      root: folderRoot(),
      onOpen: (path) => void session.openPath(path),
      onClose: closeOverlay,
    });

  const openWorkspaceSearch = () =>
    setOverlay({
      kind: "workspace-search",
      root: folderRoot(),
      onOpenMatch: (path, from, to) => void openWorkspaceMatch(path, from, to),
      onClose: closeWorkspaceSearch,
    });

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
        return openQuickOpen();
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
        return openHistory();
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
        return openTableSize();
      case "edit.search-workspace":
        return openWorkspaceSearch();
      case "view.toggle-sidebar":
        return void updateSettings({ sidebarVisible: !settings().sidebarVisible });
      case "view.command-palette":
        return openPalette();
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
      class={windowFrame({ immersive: isImmersive() })}
    >
      {/* Folding the title bar away animates its height, and the card moves up into the room */}
      <TitleBar folded={!chrome.titleBarVisible()} class={barDivider({ classic: !isImmersive() })}>
        <Show
          when={tabBarShown()}
          fallback={
            // Equal side columns keep the document name in the middle of the bar, whatever the
            // menus and the count take
            <div data-title-grid class={titleGrid}>
              <div class={titleStart}>
                <Show when={!isMacOS}>
                  <MenuBar onOpenChange={setMenuOpen} />
                </Show>
              </div>

              <div class={titleCenter}>
                <Show when={session.activeDocument()}>
                  <Show when={session.isDirty()}>
                    <span aria-hidden="true" class={dirtyDot} />
                  </Show>
                  <bdi dir="auto" class={ellipsis}>
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
        class={content({ immersive: isImmersive(), split: split() })}
      >
        <SidebarRegion
          immersive={isImmersive()}
          split={split()}
          startShown={chrome.sidebarVisible()}
          endShown={chrome.endSidebarVisible()}
          startWidth={startWidth()}
          endWidth={endWidth()}
          onStartWidth={setStartWidth}
          onEndWidth={setEndWidth}
          startControl={startControl}
          endControl={endControl}
          mode={sidebarMode()}
          hasOutline={session.activeDocument() !== undefined}
          folderRoot={folderRoot()}
          folderTitleAction={parentAction()}
          folderAction={folderAction()}
          outline={outlineList()}
          folderTree={folderTree}
          onModeChange={setPreferredMode}
        >
          {/* An immersive window shows the document as a card on the window background, which also holds the title bar and the sidebar */}
          <div class={card({ immersive: isImmersive() })}>
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
                        onSearchChange={(options) =>
                          runSearch((handle) => handle.setSearch(options))
                        }
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
        </SidebarRegion>
      </div>

      <Show when={overlay()} keyed>
        {(current) => <Overlays overlay={current} />}
      </Show>
    </div>
  );
};
