import { debounce } from "@solid-primitives/scheduled";
import { createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import type { LineEnding, OpenedDocument, TextEncoding } from "@shared/desktop-api";
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
  folder: string | undefined;
  baseUrl: string | undefined;
  markdown: string;
  /** The file's original line ending; new documents use LF. */
  lineEnding: LineEnding;
  /** The file's encoding, which a save keeps; new documents use UTF-8. */
  encoding: TextEncoding;
  isSample: boolean;
}

const SAMPLE_FILE_NAME = "Pupitre-Guide.md";
const AUTO_SAVE_DELAY = 1500;
// Saving compares the file on disk with what was last read or written; bigger files skip the comparison to keep saving fast
const MAX_CONFLICT_CHECK_BYTES = 512 * 1024;
let nextDocumentId = 1;

/**
 * The life cycle of the current document: new, open, save, save as, and the unsaved-changes prompt before replacing it.
 * The editor holds the Markdown text itself; the caller provides it through getMarkdown.
 */
export function createDocumentSession(
  getEditor: () => Pick<MarkdownEditorHandle, "getMarkdown" | "persistImages"> | undefined,
) {
  const [activeDocument, setActiveDocument] = createSignal<OpenDocument>();
  // The document has unsaved changes when its content differs from the last saved (or opened) version; undoing back to that state clears the flag
  const [savedMarkdown, setSavedMarkdown] = createSignal("");
  const [currentMarkdown, setCurrentMarkdown] = createSignal("");
  // What the file on disk is known to contain, so a change notification caused by our own save is recognized
  let diskContent = "";

  // A file deleted elsewhere stays open; until it is saved again its content exists nowhere else
  const [missingOnDisk, setMissingOnDisk] = createSignal(false);

  const isDirty = () => currentMarkdown() !== savedMarkdown() || missingOnDisk();

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
    scheduleSave.clear();
    setMissingOnDisk(false);
    setSavedMarkdown(doc.markdown);
    setCurrentMarkdown(doc.markdown);
    setActiveDocument({ ...doc, id: nextDocumentId++ });
  };

  /** A document with no file behind it: a new one or the sample, both kept in memory until saved. */
  const loadInMemory = (markdown: string, isSample: boolean) =>
    load({
      path: undefined,
      folder: undefined,
      baseUrl: undefined,
      markdown,
      lineEnding: "lf",
      encoding: "utf-8",
      isSample,
    });

  const loadOpened = (opened: OpenedDocument) => {
    diskContent = opened.content;
    load({ ...opened, markdown: opened.content, isSample: false });
  };

  const markSaved = (markdown: string) => {
    setMissingOnDisk(false);
    setSavedMarkdown(markdown);
    setCurrentMarkdown(markdown);
  };

  /** Writes the editor content to `path`, after the images it still keeps in memory. */
  const writeTo = async (doc: OpenDocument, path: string): Promise<boolean> => {
    const editor = getEditor();
    if (!editor) return false;
    await editor.persistImages(path);
    const markdown = editor.getMarkdown();
    const previousDiskContent = diskContent;
    diskContent = withTrailingNewline(markdown);
    try {
      await desktop.invoke("document:write", path, diskContent, lineEndingFor(doc), doc.encoding);
    } catch (error) {
      diskContent = previousDiskContent;
      const message = error instanceof Error ? error.message : String(error);
      await desktop.invoke(
        "dialog:show-error",
        t().dialogs.saveFailed,
        `${path}

${message}`,
      );
      return false;
    }
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

  /** False when the file was changed elsewhere and the user chose not to overwrite it. */
  const diskMatchesKnownContent = async (doc: OpenDocument): Promise<boolean> => {
    const path = doc.path ?? "";
    const disk = await desktop.invoke(
      "document:peek",
      path,
      MAX_CONFLICT_CHECK_BYTES,
      doc.encoding,
    );
    if (disk === undefined || disk === diskContent) return true;
    return resolveConflict(disk, () => void reloadFromDisk(path));
  };

  const save = async (): Promise<boolean> => {
    const doc = activeDocument();
    if (!doc) return false;
    if (!doc.path) return saveAs();
    if (!(await diskMatchesKnownContent(doc))) return false;
    return writeTo(doc, doc.path);
  };

  const scheduleSave = debounce(() => void save(), AUTO_SAVE_DELAY);

  /** Before replacing the current document, asks to save, discard or cancel if there are unsaved changes; returns whether to continue. */
  const confirmDiscard = async (): Promise<boolean> => {
    if (!isDirty()) return true;
    const choice = await desktop.invoke("dialog:confirm-unsaved", fileName());
    if (choice === "save") return save();
    return choice === "discard";
  };

  const newDocument = async () => {
    if (!(await confirmDiscard())) return;
    loadInMemory("", false);
  };

  const open = async () => {
    if (!(await confirmDiscard())) return;
    const opened = await desktop.invoke("document:open");
    if (opened) loadOpened(opened);
  };

  /** Returns the failure message when the file can't be opened; with `showError` the user is also told in a dialog. */
  const openPath = async (path: string, showError = true): Promise<string | undefined> => {
    if (!(await confirmDiscard())) return undefined;
    try {
      const opened = await desktop.invoke("document:read", path);
      // Null: the user gave up on the encoding of a file that is not UTF-8
      if (opened !== null) loadOpened(opened);
      return undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (showError) {
        await desktop.invoke("dialog:show-error", t().dialogs.openFailed, `${path}\n\n${message}`);
      }
      return message;
    }
  };

  const openSample = async () => {
    if (!(await confirmDiscard())) return;
    loadInMemory(getSampleDocument(currentLocale()), true);
  };

  /** When the window opens, the "On startup" setting decides between the welcome page, the last file or a new document. */
  const restoreOnStartup = () => {
    const { launchFile } = desktop.initialState;
    if (launchFile !== undefined) return void openPath(launchFile);
    const { startup } = settings();
    const [lastFile] = recentFiles();
    if (startup === "new-file") void newDocument();
    else if (startup === "last-file" && lastFile !== undefined) void openPath(lastFile);
  };

  /** Called when the editor content changes; with auto save on and a document path, saves shortly after typing stops. */
  const handleMarkdownChange = (markdown: string) => {
    setCurrentMarkdown(markdown);
    scheduleSave.clear();
    if (settings().autoSave && activeDocument()?.path) scheduleSave();
  };

  let askingAboutDisk = false;

  /** Asks which version wins when the file differs from what this document last saw; true means the caller may overwrite the file. */
  const resolveConflict = async (disk: string, reload: () => void): Promise<boolean> => {
    if (askingAboutDisk) return false;
    askingAboutDisk = true;
    try {
      const choice = await desktop.invoke("dialog:confirm-external-change", fileName());
      // Whatever the answer, this version of the file has been dealt with and does not ask again
      diskContent = disk;
      if (choice === "reload") reload();
      return choice === "overwrite";
    } finally {
      askingAboutDisk = false;
    }
  };

  const reloadFromDisk = async (path: string) => {
    const opened = await desktop.invoke("document:read", path).catch(() => undefined);
    const doc = activeDocument();
    if (!opened || doc?.path !== path) return;
    diskContent = opened.content;
    load({ ...doc, ...opened, markdown: opened.content });
  };

  /** Applies an edit made to the file elsewhere; with unsaved changes of its own, the document asks which version to keep. */
  const handleDiskChange = async (path: string) => {
    if (askingAboutDisk) return;
    const opened = await desktop.invoke("document:read", path).catch(() => undefined);
    const doc = activeDocument();
    if (doc?.path !== path) return;
    if (!opened) return handleDeletion(path);
    // The file is back, so what is on disk decides again whether there are unsaved changes
    setMissingOnDisk(false);
    if (opened.content === diskContent) return;

    const reload = () => load({ ...doc, ...opened, markdown: opened.content });
    if (!isDirty()) {
      diskContent = opened.content;
      return reload();
    }
    if (await resolveConflict(opened.content, reload)) await save();
  };

  const handleDeletion = async (path: string) => {
    if (missingOnDisk() || (await desktop.invoke("document:exists", path))) return;
    askingAboutDisk = true;
    try {
      const choice = await desktop.invoke("dialog:confirm-deleted", fileName());
      if (choice === "save") await save();
      else setMissingOnDisk(true);
    } finally {
      askingAboutDisk = false;
    }
  };

  /** Follows a document that was renamed in the folder tree: its text and history stay, only where it lives changes. */
  const handleRename = async (oldPath: string, newPath: string) => {
    const doc = activeDocument();
    if (doc?.path !== oldPath) return;
    setActiveDocument({ ...doc, ...(await desktop.invoke("path:locate", newPath)) });
  };

  const watchedPath = createMemo(() => activeDocument()?.path);
  createEffect(() => {
    const path = watchedPath();
    if (path === undefined) return;
    void desktop.invoke("document:watch", path);
    const unlisten = desktop.on("document:changed", (changed) => {
      if (changed === path) void handleDiskChange(path);
    });
    onCleanup(() => {
      unlisten();
      void desktop.invoke("document:unwatch", path);
    });
  });

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
    handleRename,
    restoreOnStartup,
    confirmDiscard,
    dispose: scheduleSave.clear,
  };
}
