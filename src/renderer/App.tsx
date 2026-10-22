import type { AppCommand } from "@shared/desktop-api";
import { createEffect, createSignal, on, onCleanup, onMount, Show, type Component } from "solid-js";
import { getSampleDocument } from "@/assets/sampleDocument";
import { Sidebar } from "@/components/Sidebar";
import { TitleBar } from "@/components/TitleBar";
import { Welcome } from "@/components/Welcome";
import { FindBar } from "@/features/editor/find-bar";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
  type MatchStats,
} from "@/features/editor/markdown-editor";
import type { OutlineHeading } from "@/features/editor/prose-plugins";
import { currentLocale, t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { fileNameOf, withTrailingNewline } from "@/lib/file";
import { settings, updateSettings } from "@/lib/settings";
import type { TextStats } from "@/lib/text-stats";

interface OpenDocument {
  /** Increases on every open or new document; the editor is rebuilt from it so undo history never crosses documents. */
  id: number;
  path: string | undefined;
  baseUrl: string | undefined;
  markdown: string;
  isSample: boolean;
}

let nextDocumentId = 1;

export const App: Component = () => {
  const [activeDocument, setActiveDocument] = createSignal<OpenDocument>();
  // The document has unsaved changes when its serialized content differs from the last saved (or opened) version; undoing back to that state clears the flag
  const [savedMarkdown, setSavedMarkdown] = createSignal("");
  const [currentMarkdown, setCurrentMarkdown] = createSignal("");
  const [outline, setOutline] = createSignal<OutlineHeading[]>([]);
  const [activeHeading, setActiveHeading] = createSignal(-1);
  const [stats, setStats] = createSignal<TextStats>({ words: 0, characters: 0 });
  const [findMode, setFindMode] = createSignal<"closed" | "find" | "replace">("closed");
  const [initialSearch, setInitialSearch] = createSignal("");
  const [matchStats, setMatchStats] = createSignal<MatchStats>({ current: 0, total: 0 });
  let editor: MarkdownEditorHandle | undefined;
  let autoSaveTimer: number | undefined;

  const isDirty = () => currentMarkdown() !== savedMarkdown();
  const fileName = () => {
    const doc = activeDocument();
    if (!doc) return "";
    if (doc.isSample) return "Pupitre-Guide.md";
    return doc.path ? fileNameOf(doc.path) : t().common.untitledFileName;
  };

  createEffect(() => {
    document.title = activeDocument() ? `${fileName()} - Pupitre` : "Pupitre";
  });
  createEffect(() => {
    void desktop.invoke("menu:set-document-state", {
      hasDocument: activeDocument() !== undefined,
    });
  });

  const openDocument = (doc: Omit<OpenDocument, "id">) => {
    setFindMode("closed");
    setSavedMarkdown(doc.markdown);
    setCurrentMarkdown(doc.markdown);
    setActiveDocument({ ...doc, id: nextDocumentId++ });
  };

  const markSaved = (markdown: string) => {
    setSavedMarkdown(markdown);
    setCurrentMarkdown(markdown);
  };

  const saveAs = async (): Promise<boolean> => {
    const doc = activeDocument();
    if (!doc || !editor) return false;
    const markdown = editor.getMarkdown();
    const location = await desktop.invoke(
      "document:save-as",
      fileName(),
      withTrailingNewline(markdown),
    );
    if (!location) return false;
    // Only the path changes; the editor is not rebuilt, so undo history and the cursor position stay
    setActiveDocument({ ...doc, ...location, isSample: false });
    markSaved(markdown);
    return true;
  };

  const save = async (): Promise<boolean> => {
    const doc = activeDocument();
    if (!doc || !editor) return false;
    if (!doc.path) return saveAs();
    const markdown = editor.getMarkdown();
    await desktop.invoke("document:write", doc.path, withTrailingNewline(markdown));
    markSaved(markdown);
    return true;
  };

  /** Before replacing the current document, asks to save, discard or cancel if there are unsaved changes. */
  const confirmDiscard = async (): Promise<boolean> => {
    if (!isDirty()) return true;
    const choice = await desktop.invoke("dialog:confirm-unsaved", fileName());
    if (choice === "save") return save();
    return choice === "discard";
  };

  const newDocument = async () => {
    if (!(await confirmDiscard())) return;
    openDocument({ path: undefined, baseUrl: undefined, markdown: "", isSample: false });
  };

  const open = async () => {
    if (!(await confirmDiscard())) return;
    const opened = await desktop.invoke("document:open");
    if (opened) openDocument({ ...opened, markdown: opened.content, isSample: false });
  };

  const openPath = async (path: string) => {
    if (!(await confirmDiscard())) return;
    try {
      const opened = await desktop.invoke("document:read", path);
      openDocument({ ...opened, markdown: opened.content, isSample: false });
    } catch (error) {
      await desktop.invoke(
        "dialog:show-error",
        t().dialogs.openFailed,
        `${path}\n\n${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const openSample = async () => {
    if (!(await confirmDiscard())) return;
    openDocument({
      path: undefined,
      baseUrl: undefined,
      markdown: getSampleDocument(currentLocale()),
      isSample: true,
    });
  };

  // The example document follows the interface language while it is unmodified
  createEffect(
    on(
      currentLocale,
      (locale) => {
        const doc = activeDocument();
        if (doc?.isSample && !isDirty()) {
          openDocument({ ...doc, markdown: getSampleDocument(locale) });
        }
      },
      { defer: true },
    ),
  );

  const exportPdf = async () => {
    if (!activeDocument()) return;
    const pdfName = fileName().replace(/\.(md|markdown|mdown|txt)$/i, "") + ".pdf";
    await desktop.invoke("document:export-pdf", pdfName);
  };

  const openFind = (mode: "find" | "replace") => {
    if (!activeDocument()) return;
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

  const handleMarkdownChange = (markdown: string) => {
    setCurrentMarkdown(markdown);
    if (!settings().autoSave || !activeDocument()?.path) return;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = window.setTimeout(() => void save(), 1500);
  };

  const runCommand = (command: AppCommand) => {
    switch (command.id) {
      case "file.new":
        return void newDocument();
      case "file.open":
        return void open();
      case "file.open-path":
        return void openPath(command.path);
      case "file.save":
        return void save();
      case "file.save-as":
        return void saveAs();
      case "file.export-pdf":
        return void exportPdf();
      case "edit.find":
        return openFind("find");
      case "edit.replace":
        return openFind("replace");
      case "view.toggle-sidebar":
        return void updateSettings({ sidebarVisible: !settings().sidebarVisible });
      case "help.sample-document":
        return void openSample();
    }
  };

  onMount(() => {
    // dragover's default behavior must be prevented, otherwise drop never fires
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => {
      const file = e.dataTransfer?.files[0];
      // Images dropped into the editor are handled by the editor; this only takes over Markdown files dropped on the window
      if (!file || file.type.startsWith("image/")) return;
      e.preventDefault();
      void openPath(desktop.getPathForFile(file));
    };
    const unlistenCommands = desktop.on("app:command", runCommand);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    onCleanup(() => {
      clearTimeout(autoSaveTimer);
      unlistenCommands();
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    });
  });

  return (
    <div class="h-screen w-screen flex flex-col overflow-hidden bg-surface-1 text-foreground print:block print:h-auto print:overflow-visible">
      <TitleBar
        fileName={fileName()}
        isDirty={isDirty()}
        wordsCount={stats().words}
        charsCount={stats().characters}
        hasDocument={activeDocument() !== undefined}
      />

      <div class="flex-1 flex overflow-hidden print:block print:overflow-visible">
        <Show
          when={activeDocument()}
          fallback={
            <main class="flex-1">
              <Welcome
                onNewDocument={newDocument}
                onOpenFile={open}
                onOpenRecent={openPath}
                recentFiles={settings().recentFiles}
              />
            </main>
          }
        >
          {(doc) => (
            <>
              <Show when={settings().sidebarVisible}>
                <Sidebar
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
                    onReady={markSaved}
                    onMarkdownChange={handleMarkdownChange}
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
