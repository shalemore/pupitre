import { makeEventListener } from "@solid-primitives/event-listener";
import { cn } from "cn";
import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
  Show,
  type Component,
} from "solid-js";
import type { AppCommand } from "@shared/desktop-api";
import { TitleBar } from "@/components/title-bar";
import type { OutlineHeading } from "@/features/editor/document-structure";
import { FindBar } from "@/features/editor/find-bar";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
  type MatchStats,
} from "@/features/editor/markdown-editor";
import { MenuBar } from "@/features/menu/menu-bar";
import { FolderTree } from "@/features/sidebar/folder-tree";
import { OutlineList } from "@/features/sidebar/outline-list";
import {
  SIDEBAR_WIDTH,
  Sidebar,
  SidebarPanel,
  SidebarSlot,
  type SidebarMode,
} from "@/features/sidebar/sidebar";
import { WelcomeScreen } from "@/features/welcome/welcome-screen";
import { t } from "@/i18n";
import { desktop, isMacOS } from "@/lib/desktop";
import { createDocumentSession } from "@/lib/document-session";
import { fileNameOf, isInsideFolder, isolateFileName } from "@/lib/file";
import { createImmersiveChrome } from "@/lib/immersive-chrome";
import { recentFiles } from "@/lib/recent-files";
import { settings, updateSettings } from "@/lib/settings";
import type { TextStats } from "@/lib/text-stats";

type FindMode = "closed" | "find" | "replace";

export const MainWindow: Component = () => {
  let editor: MarkdownEditorHandle | undefined;
  const session = createDocumentSession(() => editor);
  const [outline, setOutline] = createSignal<OutlineHeading[]>([]);
  const [activeHeading, setActiveHeading] = createSignal(-1);
  const [stats, setStats] = createSignal<TextStats>({ words: 0, characters: 0 });
  // A folder the user dropped in or opened; while the open file is outside of it, the file's own folder is shown instead
  const [openedFolder, setOpenedFolder] = createSignal<string>();
  const [preferredMode, setPreferredMode] = createSignal<SidebarMode>("outline");
  const [findMode, setFindMode] = createSignal<FindMode>("closed");
  const [initialSearch, setInitialSearch] = createSignal("");
  const [matchStats, setMatchStats] = createSignal<MatchStats>({ current: 0, total: 0 });
  const [menuOpen, setMenuOpen] = createSignal(false);
  const immersive = () => settings().windowStyle === "immersive";
  const chrome = createImmersiveChrome({
    canFold: () => immersive() && session.activeDocument() !== undefined,
    startPinned: () => settings().sidebarPinnedStart,
    endPinned: () => settings().sidebarPinnedEnd,
    titleBarPinned: menuOpen,
  });

  // A folder the user opened shows at once, whatever document is open; opening a document from
  // outside it hands the sidebar back to the document's own folder
  const folderRoot = createMemo(() => openedFolder() ?? session.activeDocument()?.folder);
  createEffect(
    on(
      () => session.activeDocument()?.id,
      () => {
        const folder = openedFolder();
        const path = session.activeDocument()?.path;
        if (folder !== undefined && path !== undefined && !isInsideFolder(folder, path)) {
          setOpenedFolder(undefined);
        }
      },
      { defer: true },
    ),
  );
  // The folder in the sidebar is the one whose own settings file, if it has one, applies
  createEffect(() => void desktop.invoke("workspace:set", folderRoot() ?? null));
  const split = () => settings().sidebarLayout === "split";
  // Dragging a sidebar's edge sets its width for this window only
  const [startWidth, setStartWidth] = createSignal(SIDEBAR_WIDTH.initial);
  const [endWidth, setEndWidth] = createSignal(SIDEBAR_WIDTH.initial);
  // Only an immersive window folds its sidebars, so only there can they be pinned
  const onStartPinnedChange = () =>
    immersive()
      ? (sidebarPinnedStart: boolean) => void updateSettings({ sidebarPinnedStart })
      : undefined;
  const onEndPinnedChange = () =>
    immersive()
      ? (sidebarPinnedEnd: boolean) => void updateSettings({ sidebarPinnedEnd })
      : undefined;
  // Split, the folder has its own sidebar at the start edge and the outline one at the end edge; combined, one sidebar shows either
  const startSidebarShown = () =>
    settings().sidebarVisible &&
    (split()
      ? folderRoot() !== undefined
      : session.activeDocument() !== undefined || folderRoot() !== undefined) &&
    chrome.sidebarVisible();
  const endSidebarShown = () =>
    settings().sidebarVisible &&
    session.activeDocument() !== undefined &&
    chrome.endSidebarVisible();
  const sidebarMode = (): SidebarMode => {
    if (session.activeDocument() === undefined) return "folder";
    return folderRoot() === undefined ? "outline" : preferredMode();
  };

  const outlineList = () => (
    <OutlineList
      headings={outline()}
      activeIndex={activeHeading()}
      onSelectHeading={(heading) => editor?.scrollTo(heading.pos)}
    />
  );
  const folderTree = (root: string) => (
    <FolderTree
      root={root}
      activePath={session.activeDocument()?.path}
      onOpenFile={(path) => session.openPath(path, false)}
      onPathChanged={(oldPath, newPath) => {
        // A renamed folder keeps the sidebar showing it, and a renamed document keeps its editor
        if (openedFolder() === oldPath) setOpenedFolder(newPath);
        void session.handleRename(oldPath, newPath);
      }}
    />
  );

  createEffect(() => {
    document.title = session.activeDocument()
      ? `${isolateFileName(session.fileName())} - Pupitre`
      : "Pupitre";
  });
  createEffect(() => {
    void desktop.invoke("window:set-document-state", {
      hasDocument: session.activeDocument() !== undefined,
      isDirty: session.isDirty(),
    });
  });
  // Close the find bar when the document changes; the old document's matches mean nothing
  createEffect(
    on(
      () => session.activeDocument()?.id,
      () => {
        setFindMode("closed");
        chrome.reset();
      },
    ),
  );

  const openFind = (mode: Exclude<FindMode, "closed">) => {
    if (!session.activeDocument()) return;
    setInitialSearch(editor?.getSelectedText().trim() ?? "");
    setFindMode(mode);
  };

  const closeFind = () => {
    setFindMode("closed");
    editor?.setSearch({
      search: "",
      replace: "",
      caseSensitive: false,
      wholeWord: false,
      regexp: false,
    });
    editor?.focus();
  };

  const runSearch = (action: (handle: MarkdownEditorHandle) => MatchStats) => {
    if (editor) setMatchStats(action(editor));
  };

  const showFolder = (path: string) => {
    setOpenedFolder(path);
    setPreferredMode("folder");
    if (!settings().sidebarVisible) void updateSettings({ sidebarVisible: true });
  };

  const openFolder = async () => {
    const path = await desktop.invoke("folder:choose");
    if (path !== null) showFolder(path);
  };

  const exportPdf = async () => {
    if (!session.activeDocument()) return;
    const pdfName = session.fileName().replace(/\.(md|markdown|mdown|txt)$/i, "") + ".pdf";
    const resume = await editor?.prepareForPrint();
    try {
      await desktop.invoke("document:export-pdf", pdfName);
    } finally {
      resume?.();
    }
  };

  const runCommand = (command: AppCommand) => {
    switch (command.id) {
      case "file.new":
        return void session.newDocument();
      case "file.open":
        return void session.open();
      case "file.open-folder":
        return void openFolder();
      case "file.open-path":
        return void session.openPath(command.path);
      case "file.save":
        return void session.save();
      case "file.save-as":
        return void session.saveAs();
      case "file.export-pdf":
        return void exportPdf();
      case "edit.find":
        return openFind("find");
      case "edit.replace":
        return openFind("replace");
      case "view.toggle-sidebar":
        return void updateSettings({ sidebarVisible: !settings().sidebarVisible });
      case "help.sample-document":
        return void session.openSample();
      case "format":
        return editor?.format(command.action);
      case "window.close":
        return void session.confirmDiscard().then((confirmed) => {
          if (confirmed) void desktop.invoke("window:close-confirmed");
        });
    }
  };

  onMount(() => {
    session.restoreOnStartup();
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
      class={cn(
        "h-screen w-screen flex flex-col overflow-hidden text-foreground print:block print:h-auto print:overflow-visible",
        immersive() ? "bg-surface-0" : "bg-surface-1",
      )}
    >
      {/* Folding the title bar away animates its height, and the card moves up into the room */}
      <TitleBar
        inert={!chrome.titleBarVisible()}
        class={cn(
          "overflow-hidden transition-[height] duration-sheet",
          !chrome.titleBarVisible() && "h-0",
          !immersive() && "border-b border-border",
        )}
      >
        <div class="flex items-center gap-2 me-1 pointer-events-none">
          <img src="./logo.svg" alt="" class="rounded-sm shadow-sm size-4" />
          <span class="font-semibold text-muted-foreground tracking-wide">
            {t().common.appName}
          </span>
        </div>
        <Show when={!isMacOS}>
          <MenuBar onOpenChange={setMenuOpen} />
        </Show>

        <div class="flex-1 min-w-0 px-4 flex items-center justify-center gap-2 font-medium text-foreground">
          <Show when={session.activeDocument()}>
            <Show when={session.isDirty()}>
              <span
                aria-hidden="true"
                class="size-1.5 shrink-0 rounded-full bg-brand animate-in fade-in-0 zoom-in-50 duration-snap"
              />
            </Show>
            <bdi dir="ltr" class="truncate">
              {session.fileName()}
            </bdi>
          </Show>
        </div>

        <Show when={session.activeDocument() !== undefined && settings().showWordCount}>
          <div class="text-2xs text-muted-foreground tabular-nums flex items-center gap-1.5 me-2">
            <span>{t().common.wordsCount(stats().words)}</span>
            <span>·</span>
            <span>{t().common.charsCount(stats().characters)}</span>
          </div>
        </Show>
      </TitleBar>

      <div
        onKeyDown={(event) => {
          if (!event.ctrlKey && !event.metaKey && !event.altKey) chrome.hide();
        }}
        onWheel={(event) => chrome.onWheel(event)}
        class={cn(
          "flex-1 min-h-0 flex overflow-hidden print:block print:overflow-visible",
          // The card keeps an even gap to the window edges, the title bar and the sidebars
          immersive() && cn("gap-2 py-2 ps-0 print:p-0", split() ? "pe-0" : "pe-2"),
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
                class={cn(!immersive() && "border-e border-border")}
                mode={sidebarMode()}
                pinned={settings().sidebarPinnedStart}
                onPinnedChange={onStartPinnedChange()}
                hasOutline={session.activeDocument() !== undefined}
                hasFolder={folderRoot() !== undefined}
                folderName={fileNameOf(folderRoot() ?? "")}
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
                  pinned={settings().sidebarPinnedStart}
                  onPinnedChange={onStartPinnedChange()}
                  class={cn(!immersive() && "border-e border-border")}
                >
                  {folderTree(root)}
                </SidebarPanel>
              )}
            </Show>
          </Show>
        </SidebarSlot>

        {/* An immersive window shows the document as a card on the window background, which also holds the title bar and the sidebar */}
        <div
          class={cn(
            "flex-1 min-w-0 flex overflow-hidden print:block print:overflow-visible",
            immersive() && "rounded-lg bg-surface-1 shadow-sm print:rounded-none print:shadow-none",
          )}
        >
          <Show
            when={session.activeDocument()}
            fallback={
              <main class="flex-1">
                <WelcomeScreen
                  recentFiles={recentFiles()}
                  onNewDocument={session.newDocument}
                  onOpenFile={session.open}
                  onOpenRecent={session.openPath}
                />
              </main>
            }
          >
            {(doc) => (
              <main class="flex-1 h-full overflow-hidden relative print:h-auto print:overflow-visible">
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

                {/* Rebuild the editor per document id; Save As only changes the path, so the editor and its undo history stay */}
                <Show when={doc().id} keyed>
                  <MarkdownEditor
                    markdown={doc().markdown}
                    baseUrl={doc().baseUrl}
                    documentPath={doc().path}
                    onReady={session.markSaved}
                    onMarkdownChange={session.handleMarkdownChange}
                    onOutlineChange={setOutline}
                    onActiveHeadingChange={setActiveHeading}
                    onStatsChange={setStats}
                    ref={(handle) => (editor = handle)}
                  />
                </Show>
              </main>
            )}
          </Show>
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
              class={cn(!immersive() && "border-s border-border")}
            >
              {outlineList()}
            </SidebarPanel>
          </SidebarSlot>
        </Show>
      </div>
    </div>
  );
};
