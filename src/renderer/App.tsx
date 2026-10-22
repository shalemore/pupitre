import type { AppCommand } from "@shared/desktop-api";
import { createEffect, createSignal, onCleanup, onMount, Show, type Component } from "solid-js";
import { Editor, type EditorHandle, type MatchStats } from "@/components/Editor";
import { FindReplaceBar } from "@/components/Editor/FindReplaceBar";
import { Sidebar } from "@/components/Sidebar";
import { TitleBar } from "@/components/TitleBar";
import { Welcome } from "@/components/Welcome";
import { ZoomIndicator } from "@/components/ZoomIndicator";
import { currentLocale, t, type SupportedLocale } from "@/i18n";
import { getSampleDocument } from "@/assets/sampleDocument";
import { setupBrowserInterceptors } from "@/lib/browserInterceptors";
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

  const [zoom, setZoom] = createSignal<number>(1.0);
  const [isZoomHudVisible, setIsZoomHudVisible] = createSignal<boolean>(false);
  let zoomTimeout: number | null = null;

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

  const triggerZoomHud = () => {
    setIsZoomHudVisible(true);
    if (zoomTimeout) clearTimeout(zoomTimeout);
    zoomTimeout = window.setTimeout(() => setIsZoomHudVisible(false), 1500);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(2.5, Math.round((prev + 0.1) * 10) / 10));
    triggerZoomHud();
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(0.5, Math.round((prev - 0.1) * 10) / 10));
    triggerZoomHud();
  };

  const handleZoomReset = () => {
    setZoom(1.0);
    triggerZoomHud();
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

  const toggleTheme = () => {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    void updateSettings({ theme: isDark ? "light" : "dark" });
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

  const handleOpenSettings = () => void desktop.invoke("window:open-settings");
  const handleOpenAbout = () => void desktop.invoke("app:show-about");

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

  onMount(() => {
    const cleanupInterceptors = setupBrowserInterceptors({
      onZoomIn: handleZoomIn,
      onZoomOut: handleZoomOut,
      onZoomReset: handleZoomReset,
      onFind: handleOpenFind,
      onReplace: handleOpenReplace,
    });

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // On macOS these shortcuts are handled by the native menu
      if (desktop.platform === "darwin") return;
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void (e.shiftKey ? handleSaveAs() : handleSave());
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "o") {
        e.preventDefault();
        void handleOpen();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void handleNew();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      } else if (isCmdOrCtrl && e.key === ",") {
        e.preventDefault();
        handleOpenSettings();
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (file) void handleOpenPath(desktop.getPathForFile(file));
    };

    const commands: Record<AppCommand, () => void> = {
      "file.new": () => void handleNew(),
      "file.open": () => void handleOpen(),
      "file.save": () => void handleSave(),
      "file.save-as": () => void handleSaveAs(),
      "file.export-pdf": () => void handleExportPdf(),
      "help.sample-document": () => void handleOpenSample(),
    };
    const unlistenCommands = desktop.on("app:command", (command) => commands[command]());

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("drop", handleDrop);

    onCleanup(() => {
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      if (zoomTimeout) clearTimeout(zoomTimeout);
      cleanupInterceptors();
      unlistenCommands();
      window.removeEventListener("keydown", handleGlobalKeyDown);
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
        recentFiles={settings().recentFiles}
        onNew={handleNew}
        onOpen={handleOpen}
        onOpenRecent={handleOpenPath}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onExportPdf={handleExportPdf}
        onToggleSidebar={toggleSidebar}
        onToggleTheme={toggleTheme}
        onOpenSettings={handleOpenSettings}
        onOpenAbout={handleOpenAbout}
        onOpenSample={handleOpenSample}
        onFind={handleOpenFind}
        onReplace={handleOpenReplace}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />

      <div class="flex-1 flex overflow-hidden">
        <Show when={hasDocument() && settings().sidebarVisible}>
          <Sidebar
            headings={headings()}
            currentBlockIndex={activeHeadingIndex()}
            onSelectHeading={handleSelectHeading}
            docDir={documentDirection()}
            zoom={zoom()}
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
            zoom={zoom()}
            onChange={(newSource) => updateDocument(newSource, true)}
            onCursorChange={handleCursorChange}
            ref={(h) => {
              editorHandle = h;
            }}
          />

          <ZoomIndicator
            zoom={zoom()}
            visible={isZoomHudVisible()}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onReset={handleZoomReset}
          />
        </main>
      </div>
    </div>
  );
};
