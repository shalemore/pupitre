import { createEffect, createSignal, onCleanup, onMount, Show, type Component } from "solid-js";
import { AboutModal } from "@/components/AboutModal";
import { Editor, type EditorHandle, type MatchStats } from "@/components/Editor";
import { FindReplaceBar } from "@/components/Editor/FindReplaceBar";
import { Sidebar } from "@/components/Sidebar";
import { TitleBar } from "@/components/TitleBar";
import { Welcome } from "@/components/Welcome";
import { ZoomIndicator } from "@/components/ZoomIndicator";
import { currentLocale, setLanguageSetting, t } from "@/i18n";
import type { SupportedLocale } from "@/i18n/types";
import { getSampleDocument } from "@/assets/sampleDocument";
import { setupBrowserInterceptors } from "@/lib/browserInterceptors";
import {
  addRecentFile,
  config,
  loadConfig,
  type PupitreConfig,
  setupConfigSync,
  updateConfig,
} from "@/lib/config";
import { confirmDiscard, openFileDialog, readFileFromPath, saveFileDialog } from "@/lib/file";
import { calculateStats, extractHeadings } from "@/lib/parser";
import { applyTheme, listenSystemTheme } from "@/lib/theme";
import { openSettingsWindow } from "@/lib/window";
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
  const [isDark, setIsDark] = createSignal<boolean>(false);
  const [isSidebarVisible, setIsSidebarVisible] = createSignal<boolean>(true);
  const [isAboutOpen, setIsAboutOpen] = createSignal<boolean>(false);
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

  const applyThemeFromConfig = (theme: "system" | "light" | "dark") => {
    const dark = applyTheme(theme);
    setIsDark(dark);
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
    const selected = editorHandle?.getSelectionText() ?? "";
    if (selected.trim()) {
      setInitialSearchText(selected);
    }
    setIsFindOpen(true);
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
      const matchInfo = editorHandle.setSearchQuery(q);
      setMatchStats(matchInfo);
    }
  };

  const handleFindNext = () => {
    if (editorHandle) {
      const matchInfo = editorHandle.findNext();
      setMatchStats(matchInfo);
    }
  };

  const handleFindPrev = () => {
    if (editorHandle) {
      const matchInfo = editorHandle.findPrevious();
      setMatchStats(matchInfo);
    }
  };

  const handleReplaceNext = () => {
    if (editorHandle) {
      const matchInfo = editorHandle.replaceNext();
      setMatchStats(matchInfo);
    }
  };

  const handleReplaceAll = () => {
    if (editorHandle) {
      const matchInfo = editorHandle.replaceAll();
      setMatchStats(matchInfo);
    }
  };

  onMount(async () => {
    const loaded = await loadConfig();
    setIsSidebarVisible(loaded.sidebarVisible);
    applyThemeFromConfig(loaded.theme);
    setLanguageSetting(loaded.locale);

    const unlistenSystem = listenSystemTheme((isSysDark) => {
      if (config().theme === "system") {
        setIsDark(isSysDark);
      }
    });

    const cleanupSync = setupConfigSync((newCfg) => {
      setIsSidebarVisible(newCfg.sidebarVisible);
      applyThemeFromConfig(newCfg.theme);
      setLanguageSetting(newCfg.locale);
    });

    onCleanup(() => {
      unlistenSystem();
      cleanupSync();
    });
  });

  const handleUpdateConfig = async (partial: Partial<PupitreConfig>) => {
    await updateConfig(partial);
    const cfg = config();
    if ("theme" in partial) {
      applyThemeFromConfig(cfg.theme);
    }
    if ("locale" in partial) {
      setLanguageSetting(cfg.locale);
    }
    if ("sidebarVisible" in partial) {
      setIsSidebarVisible(cfg.sidebarVisible);
    }
  };

  const toggleTheme = () => {
    const nextTheme = isDark() ? "light" : "dark";
    handleUpdateConfig({ theme: nextTheme });
  };

  const toggleSidebar = () => {
    const next = !isSidebarVisible();
    setIsSidebarVisible(next);
    handleUpdateConfig({ sidebarVisible: next });
  };

  const triggerAutoSaveIfEnabled = () => {
    if (!config().autoSave || !filePath() || !isDirty()) return;
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = window.setTimeout(async () => {
      const p = filePath();
      if (p && isDirty()) {
        await saveFileDialog(p, source());
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

  const handleContentChange = (newSource: string) => {
    updateDocument(newSource, true);
  };

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

  const handleNew = async () => {
    if (isDirty()) {
      const ok = await confirmDiscard(t().dialogs.discardActionNew);
      if (!ok) return;
    }
    setSource("");
    setHasDocument(true);
    setHeadings([]);
    setStats({ words: 0, chars: 0 });
    setFilePath(null);
    setCustomFileName(null);
    setIsSampleDoc(false);
    setIsDirty(false);
    setActiveHeadingIndex(null);
    setTimeout(() => editorHandle?.focus(), 50);
  };

  const handleStartWriting = () => {
    setSource("");
    setHasDocument(true);
    setHeadings([]);
    setStats({ words: 0, chars: 0 });
    setFilePath(null);
    setCustomFileName(null);
    setIsSampleDoc(false);
    setIsDirty(false);
    setTimeout(() => editorHandle?.focus(), 50);
  };

  const handleOpen = async () => {
    if (isDirty()) {
      const ok = await confirmDiscard(t().dialogs.discardActionOpen);
      if (!ok) return;
    }
    const result = await openFileDialog();
    if (!result) return;

    setFilePath(result.path);
    setCustomFileName(result.name);
    setIsSampleDoc(false);
    setIsDirty(false);
    setActiveHeadingIndex(null);
    updateDocument(result.content, false);
    if (result.path) {
      await addRecentFile(result.path);
    }
    setTimeout(() => editorHandle?.focus(), 50);
  };

  const handleOpenRecent = async (targetPath: string) => {
    if (isDirty()) {
      const ok = await confirmDiscard(t().dialogs.discardActionOpen);
      if (!ok) return;
    }
    try {
      const result = await readFileFromPath(targetPath);
      setFilePath(result.path);
      setCustomFileName(result.name);
      setIsSampleDoc(false);
      setIsDirty(false);
      setActiveHeadingIndex(null);
      updateDocument(result.content, false);
      await addRecentFile(targetPath);
      setTimeout(() => editorHandle?.focus(), 50);
    } catch (err) {
      console.error("Failed to open recent file:", err);
    }
  };

  const handleSave = async () => {
    const savedPath = await saveFileDialog(filePath(), source());
    if (savedPath) {
      setFilePath(savedPath);
      setCustomFileName(savedPath.split(/[\\/]/).pop() || null);
      setIsSampleDoc(false);
      setIsDirty(false);
      await addRecentFile(savedPath);
    } else if (filePath()) {
      setIsDirty(false);
    }
  };

  const handleSaveAs = async () => {
    const savedPath = await saveFileDialog(null, source());
    if (savedPath) {
      setFilePath(savedPath);
      setCustomFileName(savedPath.split(/[\\/]/).pop() || null);
      setIsSampleDoc(false);
      setIsDirty(false);
      await addRecentFile(savedPath);
    }
  };

  const handleOpenAbout = () => {
    setIsAboutOpen(true);
  };

  const handleOpenSample = async () => {
    if (isDirty()) {
      const ok = await confirmDiscard(t().dialogs.discardActionOpen);
      if (!ok) return;
    }
    const loc = currentLocale();
    setFilePath(null);
    setCustomFileName("Pupitre-Guide.md");
    lastSampleLocale = loc;
    setIsSampleDoc(true);
    updateDocument(getSampleDocument(loc), false);
    setIsDirty(false);
    setIsAboutOpen(false);
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
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (e.shiftKey) {
          handleSaveAs();
        } else {
          handleSave();
        }
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "o") {
        e.preventDefault();
        handleOpen();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNew();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      } else if (isCmdOrCtrl && e.key === ",") {
        e.preventDefault();
        openSettingsWindow();
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file) {
          if (isDirty()) {
            const ok = await confirmDiscard(t().dialogs.discardActionOpen);
            if (!ok) return;
          }
          const text = await file.text();
          const fullPath = (file as unknown as { path?: string }).path || null;
          setFilePath(fullPath);
          setCustomFileName(file.name);
          setIsSampleDoc(false);
          setIsDirty(false);
          setActiveHeadingIndex(null);
          updateDocument(text, false);
          if (fullPath) {
            await addRecentFile(fullPath);
          }
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("drop", handleDrop);

    let actionChannel: BroadcastChannel | null = null;
    const handleActionMessage = (event: MessageEvent<{ action?: string }>) => {
      if (event.data?.action === "open-sample") {
        handleOpenSample();
      }
    };
    if (typeof BroadcastChannel !== "undefined") {
      try {
        actionChannel = new BroadcastChannel("pupitre-actions");
        actionChannel.addEventListener("message", handleActionMessage);
      } catch {
        // ignore
      }
    }

    let unlistenMenu: (() => void) | null = null;
    let unlistenAppAction: (() => void) | null = null;
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      import("@tauri-apps/api/event").then(({ listen }) => {
        listen<string>("menu-action", (event) => {
          if (event.payload === "new") {
            handleNew();
          } else if (event.payload === "open") {
            handleOpen();
          } else if (event.payload === "save") {
            handleSave();
          } else if (event.payload === "preferences") {
            openSettingsWindow();
          } else if (event.payload === "about") {
            handleOpenAbout();
          } else if (event.payload === "sample-doc") {
            handleOpenSample();
          } else if (event.payload === "find") {
            handleOpenFind();
          } else if (event.payload === "replace") {
            handleOpenReplace();
          }
        }).then((fn) => {
          unlistenMenu = fn;
        });

        listen<string>("app-action", (event) => {
          if (event.payload === "open-sample") {
            handleOpenSample();
          }
        }).then((fn) => {
          unlistenAppAction = fn;
        });
      });
    }

    onCleanup(() => {
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      if (zoomTimeout) clearTimeout(zoomTimeout);
      cleanupInterceptors();
      actionChannel?.removeEventListener("message", handleActionMessage);
      actionChannel?.close();
      unlistenMenu?.();
      unlistenAppAction?.();
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
        recentFiles={config().recentFiles}
        onNew={handleNew}
        onOpen={handleOpen}
        onOpenRecent={handleOpenRecent}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onToggleSidebar={toggleSidebar}
        onToggleTheme={toggleTheme}
        onOpenSettings={openSettingsWindow}
        onOpenAbout={handleOpenAbout}
        onOpenSample={handleOpenSample}
        onFind={handleOpenFind}
        onReplace={handleOpenReplace}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />

      <div class="flex-1 flex overflow-hidden">
        <Show when={hasDocument() && isSidebarVisible()}>
          <Sidebar
            headings={headings()}
            currentBlockIndex={activeHeadingIndex()}
            onSelectHeading={handleSelectHeading}
          />
        </Show>

        <main class="flex-1 h-full overflow-hidden bg-surface-1 focus:outline-none relative">
          <Show when={!hasDocument()}>
            <div class="absolute inset-0 z-20 bg-surface-1">
              <Welcome
                onStartWriting={handleStartWriting}
                onOpenFile={handleOpen}
                onOpenRecent={handleOpenRecent}
                recentFiles={config().recentFiles}
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
            isDark={isDark()}
            fontSize={config().fontSize}
            lineHeight={config().lineHeight}
            fontFamily={config().fontFamily}
            tabSize={config().tabSize}
            wordWrap={config().wordWrap}
            editorWidth={config().editorWidth}
            zoom={zoom()}
            onChange={handleContentChange}
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

      <AboutModal
        isOpen={isAboutOpen()}
        onClose={() => setIsAboutOpen(false)}
        onOpenSample={handleOpenSample}
      />
    </div>
  );
};
