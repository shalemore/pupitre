import type { AppCommand } from "@shared/desktop-api";
import { createEffect, createSignal, onCleanup, onMount, Show, type Component } from "solid-js";
import { Editor, type EditorHandle, type MatchStats } from "@/components/Editor";
import { FindReplaceBar } from "@/components/Editor/FindReplaceBar";
import { Sidebar } from "@/components/Sidebar";
import { TitleBar } from "@/components/TitleBar";
import { Welcome } from "@/components/Welcome";
import { currentLocale, t, type SupportedLocale } from "@/i18n";
import { getSampleDocument } from "@/assets/sampleDocument";
import { desktop } from "@/lib/desktop";
import { fileNameOf, withTrailingNewline } from "@/lib/file";
import { calculateStats, detectTextDirection, extractHeadings } from "@/lib/parser";
import { settings, updateSettings } from "@/lib/settings";
import type { DocumentStats, HeadingItem } from "@/types";

export const App: Component = () => {
  const [source, setSource] = createSignal<string>("");
  const [hasDocument, setHasDocument] = createSignal<boolean>(false);
  const [headings, setHeadings] = createSignal<HeadingItem[]>([]);
  const [stats, setStats] = createSignal<DocumentStats>({ words: 0, chars: 0 });
  const [filePath, setFilePath] = createSignal<string | null>(null);
  const [customFileName, setCustomFileName] = createSignal<string | null>(null);
  const [isDirty, setIsDirty] = createSignal<boolean>(false);
  const [activeHeadingIndex, setActiveHeadingIndex] = createSignal<number | null>(null);
  const [isSampleDoc, setIsSampleDoc] = createSignal<boolean>(false);
  let lastSampleLocale: SupportedLocale | null = null;

  const [isFindOpen, setIsFindOpen] = createSignal<boolean>(false);
  const [isReplaceOpen, setIsReplaceOpen] = createSignal<boolean>(false);
  const [matchStats, setMatchStats] = createSignal<MatchStats>({ current: 0, total: 0 });
  const [initialSearchText, setInitialSearchText] = createSignal<string>("");

  let editorHandle: EditorHandle | null = null;
  let autoSaveTimeout: number | null = null;

  const displayFileName = () => {
    if (!hasDocument()) return "";
    return customFileName() ?? t().common.untitledFileName;
  };

  createEffect(() => {
    document.title = hasDocument() ? `${displayFileName()} - Pupitre` : "Pupitre";
  });

  const documentDirection = () => {
    if (isSampleDoc() && currentLocale() === "ar-SA") {
      return "rtl";
    }
    return detectTextDirection(source());
  };

  const handleOpenFind = () => {
    const selected = editorHandle?.getSelectionText() ?? "";
    if (selected.trim()) {
      setInitialSearchText(selected);
    }
    setIsFindOpen(true);
  };

  const handleOpenReplace = () => {
    handleOpenFind();
    setIsReplaceOpen(true);
  };

  const handleQueryChange = (q: {
    search: string;
    replace: string;
    caseSensitive: boolean;
    wholeWord: boolean;
    regexp: boolean;
  }) => {
    if (editorHandle) {
      setMatchStats(editorHandle.setSearchQuery(q));
    }
  };

  const handleFindNext = () => {
    if (editorHandle) setMatchStats(editorHandle.findNext());
  };

  const handleFindPrev = () => {
    if (editorHandle) setMatchStats(editorHandle.findPrevious());
  };

  const handleReplaceNext = () => {
    if (editorHandle) setMatchStats(editorHandle.replaceNext());
  };

  const handleReplaceAll = () => {
    if (editorHandle) setMatchStats(editorHandle.replaceAll());
  };

  const toggleSidebar = () => {
    void updateSettings({ sidebarVisible: !settings().sidebarVisible });
  };

  const triggerAutoSaveIfEnabled = () => {
    if (!settings().autoSave || !filePath() || !isDirty()) return;
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = window.setTimeout(async () => {
      const path = filePath();
      if (path && isDirty()) {
        await desktop.invoke("document:write", path, withTrailingNewline(source()));
        setIsDirty(false);
      }
    }, 1500);
  };

  const updateDocument = (newSource: string, markDirty = true) => {
    setSource(newSource);
    setHasDocument(true);
    setHeadings(extractHeadings(newSource));
    setStats(calculateStats(newSource));
    if (markDirty) {
      setIsDirty(true);
      triggerAutoSaveIfEnabled();
    }
  };

  createEffect(() => {
    const loc = currentLocale();
    if (isSampleDoc() && !isDirty()) {
      if (lastSampleLocale !== loc) {
        lastSampleLocale = loc;
        updateDocument(getSampleDocument(loc), false);
        setIsDirty(false);
      }
    } else if (!isSampleDoc()) {
      lastSampleLocale = null;
    }
  });

  const handleCursorChange = (cursorPos: number) => {
    const list = headings();
    let current: number | null = null;
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      if (h && h.pos !== undefined && h.pos <= cursorPos) {
        current = i;
      } else {
        break;
      }
    }
    setActiveHeadingIndex(current);
  };

  const handleSelectHeading = (headingIndex: number) => {
    const targetHeading = headings()[headingIndex];
    if (targetHeading?.pos !== undefined && editorHandle) {
      editorHandle.scrollToPos(targetHeading.pos);
    }
  };

  const loadDocument = (path: string | null, name: string | null, content: string) => {
    setFilePath(path);
    setCustomFileName(name);
    setIsSampleDoc(false);
    setIsDirty(false);
    setActiveHeadingIndex(null);
    updateDocument(content, false);
    setTimeout(() => editorHandle?.focus(), 50);
  };

  const handleSave = async (): Promise<boolean> => {
    const content = withTrailingNewline(source());
    const path = filePath();
    if (path) {
      await desktop.invoke("document:write", path, content);
      setIsDirty(false);
      return true;
    }
    return handleSaveAs();
  };

  const handleSaveAs = async (): Promise<boolean> => {
    const savedPath = await desktop.invoke(
      "document:save-as",
      displayFileName(),
      withTrailingNewline(source()),
    );
    if (!savedPath) return false;
    setFilePath(savedPath);
    setCustomFileName(fileNameOf(savedPath));
    setIsSampleDoc(false);
    setIsDirty(false);
    return true;
  };

  /** Before replacing the current document, asks to save, discard or cancel if there are unsaved changes. */
  const confirmReplaceDocument = async (): Promise<boolean> => {
    if (!isDirty()) return true;
    const choice = await desktop.invoke("dialog:confirm-unsaved", displayFileName());
    if (choice === "save") return handleSave();
    return choice === "discard";
  };

  const handleNew = async () => {
    if (!(await confirmReplaceDocument())) return;
    loadDocument(null, null, "");
  };

  const handleOpen = async () => {
    if (!(await confirmReplaceDocument())) return;
    const opened = await desktop.invoke("document:open");
    if (opened) loadDocument(opened.path, fileNameOf(opened.path), opened.content);
  };

  const handleOpenPath = async (path: string) => {
    if (!(await confirmReplaceDocument())) return;
    try {
      const opened = await desktop.invoke("document:read", path);
      loadDocument(opened.path, fileNameOf(opened.path), opened.content);
    } catch (err) {
      await desktop.invoke(
        "dialog:show-error",
        t().dialogs.openFailed,
        `${path}\n\n${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const [isExportingPdf, setIsExportingPdf] = createSignal<boolean>(false);

  const handleExportPdf = async () => {
    if (!hasDocument() || isExportingPdf() || !source().trim()) return;
    setIsExportingPdf(true);
    try {
      const { exportMarkdownToPdf } = await import("@/lib/exportPdf");
      await exportMarkdownToPdf(source(), displayFileName());
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleOpenSample = async () => {
    if (!(await confirmReplaceDocument())) return;
    const loc = currentLocale();
    setFilePath(null);
    setCustomFileName("Pupitre-Guide.md");
    lastSampleLocale = loc;
    setIsSampleDoc(true);
    updateDocument(getSampleDocument(loc), false);
    setIsDirty(false);
    setTimeout(() => editorHandle?.focus(), 50);
  };

  createEffect(() => {
    void desktop.invoke("menu:set-document-state", { hasDocument: hasDocument() });
  });

  const runCommand = (command: AppCommand) => {
    switch (command.id) {
      case "file.new":
        return void handleNew();
      case "file.open":
        return void handleOpen();
      case "file.open-path":
        return void handleOpenPath(command.path);
      case "file.save":
        return void handleSave();
      case "file.save-as":
        return void handleSaveAs();
      case "file.export-pdf":
        return void handleExportPdf();
      case "edit.find":
        return handleOpenFind();
      case "edit.replace":
        return handleOpenReplace();
      case "view.toggle-sidebar":
        return toggleSidebar();
      case "help.sample-document":
        return void handleOpenSample();
    }
  };

  onMount(() => {
    // dragover's default behavior must be prevented, otherwise drop never fires
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (file) void handleOpenPath(desktop.getPathForFile(file));
    };
    const unlistenCommands = desktop.on("app:command", runCommand);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    onCleanup(() => {
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      unlistenCommands();
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    });
  });

  return (
    <div class="h-screen w-screen flex flex-col overflow-hidden bg-surface-1 text-foreground">
      <TitleBar
        fileName={displayFileName()}
        isDirty={isDirty()}
        wordsCount={stats().words}
        charsCount={stats().chars}
        hasDocument={hasDocument()}
      />

      <div class="flex-1 flex overflow-hidden">
        <Show when={hasDocument() && settings().sidebarVisible}>
          <Sidebar
            headings={headings()}
            currentBlockIndex={activeHeadingIndex()}
            onSelectHeading={handleSelectHeading}
          />
        </Show>

        <main
          dir={documentDirection()}
          class="flex-1 h-full overflow-hidden bg-surface-1 focus:outline-none relative"
        >
          <Show when={!hasDocument()}>
            <div class="absolute inset-0 z-20 bg-surface-1">
              <Welcome
                onStartWriting={handleNew}
                onOpenFile={handleOpen}
                onOpenRecent={handleOpenPath}
                recentFiles={settings().recentFiles}
              />
            </div>
          </Show>

          <FindReplaceBar
            isOpen={isFindOpen()}
            isReplaceOpen={isReplaceOpen()}
            onClose={() => {
              setIsFindOpen(false);
              editorHandle?.focus();
            }}
            onToggleReplace={() => setIsReplaceOpen(!isReplaceOpen())}
            onFindNext={handleFindNext}
            onFindPrev={handleFindPrev}
            onReplaceNext={handleReplaceNext}
            onReplaceAll={handleReplaceAll}
            onQueryChange={handleQueryChange}
            matchStats={matchStats()}
            initialSearchText={initialSearchText()}
          />

          <Editor
            content={source()}
            fontSize={settings().fontSize}
            lineHeight={settings().lineHeight}
            fontFamily={settings().fontFamily}
            fallbackFont={settings().fallbackFont}
            tabSize={settings().tabSize}
            wordWrap={settings().wordWrap}
            editorWidth={settings().editorWidth}
            blockSpacing={settings().blockSpacing}
            onChange={(newSource) => updateDocument(newSource, true)}
            onCursorChange={handleCursorChange}
            ref={(h) => {
              editorHandle = h;
            }}
          />
        </main>
      </div>
    </div>
  );
};
