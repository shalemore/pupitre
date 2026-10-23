import type { AppCommand } from "@shared/desktop-api";
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
import { TitleBar } from "@/components/title-bar";
import { createDocumentSession } from "@/features/document/document-session";
import { FindBar } from "@/features/editor/find-bar";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
  type MatchStats,
} from "@/features/editor/markdown-editor";
import type { OutlineHeading } from "@/features/editor/prose-plugins";
import { FolderTree } from "@/features/folder/folder-tree";
import { MenuBar } from "@/features/menu/menu-bar";
import { OutlineList } from "@/features/outline/outline-list";
import { Sidebar, type SidebarMode } from "@/features/sidebar/sidebar";
import { WelcomeScreen } from "@/features/welcome/welcome-screen";
import { t } from "@/i18n";
import { desktop, isMacOS } from "@/lib/desktop";
import { dirnameOf, fileNameOf, isInsideFolder } from "@/lib/file";
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
  // A folder the user dropped in; while the open file is outside of it, the file's own folder is shown instead
  const [droppedFolder, setDroppedFolder] = createSignal<string>();
  const [preferredMode, setPreferredMode] = createSignal<SidebarMode>("outline");
  const [findMode, setFindMode] = createSignal<FindMode>("closed");
  const [initialSearch, setInitialSearch] = createSignal("");
  const [matchStats, setMatchStats] = createSignal<MatchStats>({ current: 0, total: 0 });
  // The frame is fixed when the window is created, so the layout follows it rather than the setting
  const immersive = desktop.initialState.frame.style === "immersive";
  const chrome = createImmersiveChrome({
    enabled: immersive,
    hasDocument: () => session.activeDocument() !== undefined,
  });

  const folderRoot = createMemo(() => {
    const dropped = droppedFolder();
    const path = session.activeDocument()?.path;
    if (dropped !== undefined && (path === undefined || isInsideFolder(dropped, path))) {
      return dropped;
    }
    return path === undefined ? dropped : dirnameOf(path);
  });
  const sidebarMode = (): SidebarMode => {
    if (session.activeDocument() === undefined) return "folder";
    return folderRoot() === undefined ? "outline" : preferredMode();
  };

  createEffect(() => {
    document.title = session.activeDocument() ? `${session.fileName()} - Pupitre` : "Pupitre";
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

  const exportPdf = async () => {
    if (!session.activeDocument()) return;
    const pdfName = session.fileName().replace(/\.(md|markdown|mdown|txt)$/i, "") + ".pdf";
    await desktop.invoke("document:export-pdf", pdfName);
  };

  const runCommand = (command: AppCommand) => {
    switch (command.id) {
      case "file.new":
        return void session.newDocument();
      case "file.open":
        return void session.open();
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
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => {
      const file = e.dataTransfer?.files[0];
      if (file && e.dataTransfer?.items[0]?.webkitGetAsEntry()?.isDirectory) {
        e.preventDefault();
        setDroppedFolder(desktop.getPathForFile(file));
        setPreferredMode("folder");
        if (!settings().sidebarVisible) void updateSettings({ sidebarVisible: true });
        return;
      }
      // Images dropped into the editor are handled by the editor; this only takes over Markdown files dropped on the window
      if (!file || file.type.startsWith("image/")) return;
      e.preventDefault();
      void session.openPath(desktop.getPathForFile(file));
    };
    const unlistenCommands = desktop.on("app:command", runCommand);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    onCleanup(() => {
      session.dispose();
      unlistenCommands();
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    });
  });

  return (
    <div
      data-window-style={desktop.initialState.frame.style}
      onPointerMove={(event) => chrome.onPointerMove(event)}
      onPointerLeave={() => chrome.onPointerLeave()}
      class={cn(
        "h-screen w-screen overflow-hidden text-foreground print:block print:h-auto print:overflow-visible",
        immersive ? "app-drag bg-surface-0 p-1.5 print:p-0" : "bg-surface-1",
      )}
    >
      <div
        class={cn(
          "relative flex size-full flex-col overflow-hidden print:block print:h-auto print:overflow-visible",
          immersive &&
            "app-no-drag rounded-xl border border-border/80 bg-surface-1 shadow-sm print:rounded-none print:border-0 print:shadow-none",
        )}
      >
        <TitleBar
          class={cn(
            immersive && "absolute inset-x-0 top-0 transition-[translate,opacity] duration-200",
            !chrome.titleBarVisible() && "pointer-events-none -translate-y-full opacity-0",
          )}
        >
          <div class="flex items-center gap-2 me-1 pointer-events-none">
            <img src="./logo.svg" alt="" class="rounded-sm shadow-sm size-4" />
            <span class="font-semibold text-muted-foreground tracking-wide">
              {t().common.appName}
            </span>
          </div>
          <Show when={!isMacOS}>
            <MenuBar />
          </Show>

          <div class="flex-1 min-w-0 px-4 text-center font-medium text-foreground truncate">
            <Show when={session.activeDocument()}>
              {session.isDirty() ? "● " : ""}
              <bdi>{session.fileName()}</bdi>
            </Show>
          </div>

          <Show when={session.activeDocument() !== undefined && settings().showWordCount}>
            <div class="text-[11px] text-muted-foreground tabular-nums flex items-center gap-1.5 me-2">
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
          onWheel={() => chrome.hide()}
          class="flex-1 flex overflow-hidden print:block print:overflow-visible"
        >
          <Show
            when={
              settings().sidebarVisible &&
              (session.activeDocument() !== undefined || folderRoot() !== undefined)
            }
          >
            <div
              class={cn(
                immersive
                  ? "relative shrink-0 transition-[width] duration-200 print:hidden"
                  : "contents",
                immersive && (chrome.sidebarDocked() ? "w-66" : "w-0"),
              )}
            >
              <Sidebar
                class={cn(
                  immersive &&
                    "absolute top-12 bottom-2 inset-s-2 z-20 h-auto rounded-lg border shadow-lg transition-[translate,opacity] duration-200",
                  !chrome.sidebarVisible() &&
                    "pointer-events-none -translate-x-[calc(100%+1rem)] opacity-0 rtl:translate-x-[calc(100%+1rem)]",
                )}
                mode={sidebarMode()}
                hasOutline={session.activeDocument() !== undefined}
                hasFolder={folderRoot() !== undefined}
                folderName={fileNameOf(folderRoot() ?? "")}
                onModeChange={setPreferredMode}
                outline={
                  <OutlineList
                    headings={outline()}
                    activeIndex={activeHeading()}
                    onSelectHeading={(heading) => editor?.scrollTo(heading.pos)}
                  />
                }
                folder={
                  <Show when={folderRoot()} keyed>
                    {(root) => (
                      <FolderTree
                        root={root}
                        activePath={session.activeDocument()?.path}
                        onOpenFile={(path) => session.openPath(path, false)}
                      />
                    )}
                  </Show>
                }
              />
            </div>
          </Show>

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
                    class={cn(immersive && "top-13")}
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
      </div>
    </div>
  );
};
