import type { AppCommand } from "@shared/desktop-api";
import { createEffect, createSignal, on, onCleanup, onMount, Show, type Component } from "solid-js";
import { TitleBar } from "@/components/title-bar";
import { createDocumentSession } from "@/features/document/document-session";
import { FindBar } from "@/features/editor/find-bar";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
  type MatchStats,
} from "@/features/editor/markdown-editor";
import type { OutlineHeading } from "@/features/editor/prose-plugins";
import { MenuBar } from "@/features/menu/menu-bar";
import { OutlineSidebar } from "@/features/outline/outline-sidebar";
import { WelcomeScreen } from "@/features/welcome/welcome-screen";
import { t } from "@/i18n";
import { desktop, isMacOS } from "@/lib/desktop";
import { settings, updateSettings } from "@/lib/settings";
import type { TextStats } from "@/lib/text-stats";

type FindMode = "closed" | "find" | "replace";

export const MainWindow: Component = () => {
  let editor: MarkdownEditorHandle | undefined;
  const session = createDocumentSession(() => editor?.getMarkdown());
  const [outline, setOutline] = createSignal<OutlineHeading[]>([]);
  const [activeHeading, setActiveHeading] = createSignal(-1);
  const [stats, setStats] = createSignal<TextStats>({ words: 0, characters: 0 });
  const [findMode, setFindMode] = createSignal<FindMode>("closed");
  const [initialSearch, setInitialSearch] = createSignal("");
  const [matchStats, setMatchStats] = createSignal<MatchStats>({ current: 0, total: 0 });

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
      () => setFindMode("closed"),
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
    <div class="h-screen w-screen flex flex-col overflow-hidden bg-surface-1 text-foreground print:block print:h-auto print:overflow-visible">
      <TitleBar>
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
            {session.fileName()}
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

      <div class="flex-1 flex overflow-hidden print:block print:overflow-visible">
        <Show
          when={session.activeDocument()}
          fallback={
            <main class="flex-1">
              <WelcomeScreen
                recentFiles={settings().recentFiles}
                onNewDocument={session.newDocument}
                onOpenFile={session.open}
                onOpenRecent={session.openPath}
              />
            </main>
          }
        >
          {(doc) => (
            <>
              <Show when={settings().sidebarVisible}>
                <OutlineSidebar
                  headings={outline()}
                  activeIndex={activeHeading()}
                  onSelectHeading={(heading) => editor?.scrollTo(heading.pos)}
                />
              </Show>

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
            </>
          )}
        </Show>
      </div>
    </div>
  );
};
