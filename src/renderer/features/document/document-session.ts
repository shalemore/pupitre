import type { LineEnding } from "@shared/desktop-api";
import { createEffect, createSignal, on } from "solid-js";
import type { MarkdownEditorHandle } from "@/features/editor/markdown-editor";
import { getSampleDocument } from "@/features/samples/sample-document";
import { currentLocale, t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { fileNameOf, withTrailingNewline } from "@/lib/file";
import { recentFiles } from "@/lib/recent-files";
import { settings } from "@/lib/settings";

export interface OpenDocument {
  /** Increases on every open or new document; the editor is rebuilt from it so undo history never crosses documents. */
  id: number;
  path: string | undefined;
  baseUrl: string | undefined;
  markdown: string;
  /** The file's original line ending; new documents use LF. */
  lineEnding: LineEnding;
  isSample: boolean;
}

const SAMPLE_FILE_NAME = "Pupitre-Guide.md";
const AUTO_SAVE_DELAY = 1500;
let nextDocumentId = 1;

/**
 * The life cycle of the current document: new, open, save, save as, and the unsaved-changes prompt before replacing it.
 * The editor content is serialized only on save; the caller provides it through getMarkdown.
 */
export function createDocumentSession(
  getEditor: () => Pick<MarkdownEditorHandle, "getMarkdown" | "persistImages"> | undefined,
) {
  const [activeDocument, setActiveDocument] = createSignal<OpenDocument>();
  // The document has unsaved changes when its serialized content differs from the last saved (or opened) version; undoing back to that state clears the flag
  const [savedMarkdown, setSavedMarkdown] = createSignal("");
  const [currentMarkdown, setCurrentMarkdown] = createSignal("");
  let autoSaveTimer: number | undefined;

  const isDirty = () => currentMarkdown() !== savedMarkdown();

  // "Keep as is" keeps the file's own line endings; otherwise the setting decides
  const lineEndingFor = (doc: OpenDocument): LineEnding => {
    const preference = settings().lineEnding;
    return preference === "auto" ? doc.lineEnding : preference;
  };

  const fileName = () => {
    const doc = activeDocument();
    if (!doc) return "";
    if (doc.isSample) return SAMPLE_FILE_NAME;
    return doc.path ? fileNameOf(doc.path) : t().common.untitledFileName;
  };

  const load = (doc: Omit<OpenDocument, "id">) => {
    clearTimeout(autoSaveTimer);
    setSavedMarkdown(doc.markdown);
    setCurrentMarkdown(doc.markdown);
    setActiveDocument({ ...doc, id: nextDocumentId++ });
  };

  const markSaved = (markdown: string) => {
    setSavedMarkdown(markdown);
    setCurrentMarkdown(markdown);
  };

  /** Writes the editor content to `path`, after the images it still keeps in memory. */
  const writeTo = async (doc: OpenDocument, path: string): Promise<boolean> => {
    const editor = getEditor();
    if (!editor) return false;
    await editor.persistImages(path);
    const markdown = editor.getMarkdown();
    await desktop.invoke("document:write", path, withTrailingNewline(markdown), lineEndingFor(doc));
    markSaved(markdown);
    return true;
  };

  const saveAs = async (): Promise<boolean> => {
    const doc = activeDocument();
    if (!doc) return false;
    const location = await desktop.invoke("dialog:choose-save-path", fileName());
    if (!location) return false;
    // Only the path changes, not the document id, so the editor and its undo history stay; the
    // new folder resolves relative image paths from now on
    setActiveDocument({ ...doc, ...location, isSample: false });
    return writeTo(doc, location.path);
  };

  const save = async (): Promise<boolean> => {
    const doc = activeDocument();
    if (!doc) return false;
    return doc.path ? writeTo(doc, doc.path) : saveAs();
  };

  /** Before replacing the current document, asks to save, discard or cancel if there are unsaved changes; returns whether to continue. */
  const confirmDiscard = async (): Promise<boolean> => {
    if (!isDirty()) return true;
    const choice = await desktop.invoke("dialog:confirm-unsaved", fileName());
    if (choice === "save") return save();
    return choice === "discard";
  };

  const newDocument = async () => {
    if (!(await confirmDiscard())) return;
    load({ path: undefined, baseUrl: undefined, markdown: "", lineEnding: "lf", isSample: false });
  };

  const open = async () => {
    if (!(await confirmDiscard())) return;
    const opened = await desktop.invoke("document:open");
    if (opened) load({ ...opened, markdown: opened.content, isSample: false });
  };

  const openPath = async (path: string) => {
    if (!(await confirmDiscard())) return;
    try {
      const opened = await desktop.invoke("document:read", path);
      load({ ...opened, markdown: opened.content, isSample: false });
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
    load({
      path: undefined,
      baseUrl: undefined,
      markdown: getSampleDocument(currentLocale()),
      lineEnding: "lf",
      isSample: true,
    });
  };

  /** When the window opens, the "On startup" setting decides between the welcome page, the last file or a new document. */
  const restoreOnStartup = () => {
    const { startup } = settings();
    const [lastFile] = recentFiles();
    if (startup === "new-file") void newDocument();
    else if (startup === "last-file" && lastFile !== undefined) void openPath(lastFile);
  };

  /** Called when the editor content changes; with auto save on and a document path, saves shortly after typing stops. */
  const handleMarkdownChange = (markdown: string) => {
    setCurrentMarkdown(markdown);
    clearTimeout(autoSaveTimer);
    if (settings().autoSave && activeDocument()?.path) {
      autoSaveTimer = window.setTimeout(() => void save(), AUTO_SAVE_DELAY);
    }
  };

  // The example document follows the interface language while it is unmodified
  createEffect(
    on(
      currentLocale,
      (locale) => {
        const doc = activeDocument();
        if (doc?.isSample && !isDirty()) load({ ...doc, markdown: getSampleDocument(locale) });
      },
      { defer: true },
    ),
  );

  return {
    activeDocument,
    isDirty,
    fileName,
    markSaved,
    handleMarkdownChange,
    save,
    saveAs,
    newDocument,
    open,
    openPath,
    openSample,
    restoreOnStartup,
    confirmDiscard,
    dispose: () => clearTimeout(autoSaveTimer),
  };
}
