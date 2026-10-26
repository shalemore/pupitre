import { debounce } from "@solid-primitives/scheduled";
import { batch, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import type {
  Draft,
  DraftSession,
  LineEnding,
  OpenedDocument,
  TextEncoding,
} from "@shared/desktop-api";
import { createPendingImages, type PendingImages } from "@/features/editor/images";
import type { MarkdownEditorHandle } from "@/features/editor/markdown-editor";
import { getSampleDocument } from "@/features/samples/sample-document";
import { currentLocale, t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { messageOf, reportFailure } from "@/lib/errors";
import { fileNameOf, withTrailingNewline } from "@/lib/file";
import { recentFiles } from "@/lib/recent-files";
import { settings } from "@/lib/settings";

/** The file behind a tab, the way it was opened and is written back. */
export interface OpenDocument {
  /**
   * Increases whenever the editor has to be built again around another text, which is every time
   * another tab is shown and every time a file is reloaded, so undo history never crosses them.
   */
  id: number;
  path: string | undefined;
  folder: string | undefined;
  baseUrl: string | undefined;
  /** The file's original line ending; new documents use LF. */
  lineEnding: LineEnding;
  /** The file's encoding, which a save keeps; new documents use UTF-8. */
  encoding: TextEncoding;
  isSample: boolean;
}

/** One open document, with the text being edited and the version it is compared to. */
export interface Tab {
  /** Names the tab itself: switching and closing address a tab by it, and it stays when the text is reloaded. */
  id: number;
  doc: OpenDocument;
  markdown: string;
  /** What the file or the tab last held; the tab is dirty while `markdown` differs from it. */
  savedMarkdown: string;
  /** The file was deleted elsewhere; until the tab is saved again its text exists nowhere else. */
  missingOnDisk: boolean;
  /** What the file on disk is known to contain, so a change caused by the tab's own save is recognized. */
  diskContent: string;
  /** The user let this tab's changes go on the way out; no draft of it is kept until it is typed into again. */
  discarded: boolean;
  /**
   * Pictures pasted into the document before it had a file. They belong to the tab: switching tabs
   * rebuilds the editor that showed them, and a save of any tab has to write them first.
   */
  pendingImages: PendingImages;
}

const SAMPLE_FILE_NAME = "Pupitre-Guide.md";
const AUTO_SAVE_DELAY = 1500;
// A draft follows the pause after typing, not the keystrokes themselves; the main process writes it out a moment later
const DRAFT_WRITE_DELAY = 1000;
// Saving compares the file on disk with what was last read or written; bigger files skip the comparison to keep saving fast
const MAX_CONFLICT_CHECK_BYTES = 512 * 1024;
let nextDocumentId = 1;
let nextTabId = 1;

export const isTabDirty = (tab: Tab) => tab.markdown !== tab.savedMarkdown || tab.missingOnDisk;

/**
 * The open tabs and the life cycle of the document in each: new, open, save, save as, close, and
 * the unsaved-changes prompt before a tab or the window goes. The editor holds the Markdown text of
 * the active tab; the caller provides it through getMarkdown.
 */
export function createDocumentSession(
  getEditor: () => Pick<MarkdownEditorHandle, "getMarkdown" | "persistImages"> | undefined,
) {
  const [tabs, setTabs] = createSignal<Tab[]>([]);
  const [activeTabId, setActiveTabId] = createSignal<number>();
  // False until the window has read what an earlier session left; an empty session before that says
  // nothing about drafts, and dropping the one a crash wrote would lose the work it holds
  const [startupDone, setStartupDone] = createSignal(false);

  const activeTab = () => tabs().find((tab) => tab.id === activeTabId());
  const activeDocument = () => activeTab()?.doc;
  const isDirty = () => {
    const tab = activeTab();
    return tab !== undefined && isTabDirty(tab);
  };
  /** Whether any tab has unsaved changes, which is what closing the window has to ask about. */
  const hasDirtyTabs = () => tabs().some(isTabDirty);

  const tabOfPath = (path: string) => tabs().find((tab) => tab.doc.path === path);

  const patchTab = (id: number, patch: Partial<Tab>) =>
    setTabs(tabs().map((tab) => (tab.id === id ? Object.assign({}, tab, patch) : tab)));

  // "Keep as is" keeps the file's own line endings; otherwise the setting decides
  const lineEndingFor = (doc: OpenDocument): LineEnding => {
    const preference = settings().lineEnding;
    return preference === "auto" ? doc.lineEnding : preference;
  };

  const tabFileName = (tab: Tab): string => {
    if (tab.doc.isSample) return SAMPLE_FILE_NAME;
    return tab.doc.path ? fileNameOf(tab.doc.path) : t().common.untitledFileName;
  };

  const fileName = () => {
    const tab = activeTab();
    return tab === undefined ? "" : tabFileName(tab);
  };

  /**
   * Adds a tab for `doc` holding `markdown` and activates it; `text` says what its text is compared
   * to, which defaults to the text it is loaded with, so a tab starts out clean.
   */
  const addTab = (
    doc: Omit<OpenDocument, "id">,
    markdown: string,
    text: { savedMarkdown: string; diskContent: string } = {
      savedMarkdown: markdown,
      diskContent: "",
    },
  ) => {
    const id = nextTabId++;
    batch(() => {
      setTabs([
        ...tabs(),
        {
          id,
          doc: { ...doc, id: nextDocumentId++ },
          markdown,
          savedMarkdown: text.savedMarkdown,
          missingOnDisk: false,
          diskContent: text.diskContent,
          discarded: false,
          pendingImages: createPendingImages(),
        },
      ]);
      setActiveTabId(id);
    });
  };

  /** A document with no file behind it: a new one or the sample, both kept in memory until saved. */
  const inMemoryDocument = (isSample: boolean): Omit<OpenDocument, "id"> => ({
    path: undefined,
    folder: undefined,
    baseUrl: undefined,
    lineEnding: "lf",
    encoding: "utf-8",
    isSample,
  });

  /** Shows a file that was read: in the tab that already holds it, or in a new one. */
  const showOpened = (opened: OpenedDocument) => {
    const open = tabOfPath(opened.path);
    if (open !== undefined) {
      setActiveTabId(open.id);
      return;
    }
    addTab({ ...opened, isSample: false }, opened.content, {
      savedMarkdown: opened.content,
      diskContent: opened.content,
    });
  };

  /** Replaces the text of a tab with what a file now holds; the editor is rebuilt when it shows that tab. */
  const showReloaded = (tab: Tab, opened: OpenedDocument) => {
    patchTab(tab.id, {
      doc: { ...tab.doc, ...opened, id: nextDocumentId++ },
      markdown: opened.content,
      savedMarkdown: opened.content,
      missingOnDisk: false,
      diskContent: opened.content,
      discarded: false,
    });
  };

  /** Writes the tab's text to `path`, after the images the editor still keeps in memory. */
  const writeTab = async (tab: Tab, path: string): Promise<boolean> => {
    // The editor holds the tab being shown; any other tab is written from the text the session keeps for it
    const editor = tab.id === activeTabId() ? getEditor() : undefined;
    if (tab.id === activeTabId() && editor === undefined) return false;
    let markdown = tab.markdown;
    if (editor !== undefined) {
      await editor.persistImages(path);
      markdown = editor.getMarkdown();
    } else {
      // The tab on show is not the only one a save can reach: the images pasted into another one are
      // still in memory, and their blob: URLs must not reach the file
      markdown = await tab.pendingImages.persistText(markdown, path);
    }
    const previousDiskContent = tab.diskContent;
    const diskContent = withTrailingNewline(markdown);
    patchTab(tab.id, { diskContent });
    try {
      await desktop.invoke(
        "document:write",
        path,
        diskContent,
        lineEndingFor(tab.doc),
        tab.doc.encoding,
      );
    } catch (error) {
      patchTab(tab.id, { diskContent: previousDiskContent });
      const message = messageOf(error);
      await reportFailure(t().dialogs.saveFailed, path, message);
      return false;
    }
    patchTab(tab.id, { markdown, savedMarkdown: markdown, missingOnDisk: false });
    return true;
  };

  const saveTabAs = async (id: number): Promise<boolean> => {
    const tab = tabs().find((candidate) => candidate.id === id);
    if (tab === undefined) return false;
    const location = await desktop.invoke("dialog:choose-save-path", tabFileName(tab));
    if (!location) return false;
    // Only the path changes, not the document id, so the editor and its undo history stay; the
    // new folder resolves relative image paths from now on
    const moved = { ...tab, doc: { ...tab.doc, ...location, isSample: false } };
    patchTab(id, { doc: moved.doc });
    return writeTab(moved, location.path);
  };

  /** False when the file was changed elsewhere and the user chose not to overwrite it. */
  const diskMatchesKnownContent = async (tab: Tab): Promise<boolean> => {
    const path = tab.doc.path ?? "";
    const disk = await desktop.invoke(
      "document:peek",
      path,
      MAX_CONFLICT_CHECK_BYTES,
      tab.doc.encoding,
    );
    if (disk === undefined || disk === tab.diskContent) return true;
    return resolveConflict(tab, disk, () => void reloadTab(tab.id));
  };

  const saveTab = async (id: number): Promise<boolean> => {
    const tab = tabs().find((candidate) => candidate.id === id);
    if (tab === undefined) return false;
    const path = tab.doc.path;
    if (path === undefined) return saveTabAs(id);
    if (!(await diskMatchesKnownContent(tab))) return false;
    return writeTab(tab, path);
  };

  const save = async (): Promise<boolean> => {
    const tab = activeTab();
    return tab === undefined ? false : saveTab(tab.id);
  };

  const saveAs = async (): Promise<boolean> => {
    const tab = activeTab();
    return tab === undefined ? false : saveTabAs(tab.id);
  };

  /**
   * Saves every tab with changes and a file behind it: the delay follows the typing, so a pause
   * reaches the file that was typed in even when another tab was shown in the meantime. One tab at
   * a time, since a save may ask about a file changed elsewhere and only one question can be asked.
   */
  const saveDirtyTabs = () =>
    tabs()
      .filter((tab) => isTabDirty(tab) && tab.doc.path !== undefined)
      .reduce<Promise<boolean>>(
        (previous, tab) => previous.then(() => saveTab(tab.id)),
        Promise.resolve(true),
      );

  const scheduleSave = debounce(() => void saveDirtyTabs(), AUTO_SAVE_DELAY);

  /** One tab as a crash would leave it: the text being edited, and the version it is compared to. */
  const draftOfTab = (tab: Tab): Draft => ({
    path: tab.doc.path,
    folder: tab.doc.folder,
    baseUrl: tab.doc.baseUrl,
    markdown: tab.markdown,
    savedMarkdown: tab.savedMarkdown,
    lineEnding: tab.doc.lineEnding,
    encoding: tab.doc.encoding,
    isSample: tab.doc.isSample,
  });

  /** What a crash would bring back: every tab with unsaved changes, and which of them was being edited. */
  const currentDraft = (): DraftSession | undefined => {
    const unsaved = tabs().filter((tab) => !tab.discarded && isTabDirty(tab));
    if (unsaved.length === 0) return undefined;
    // The active tab is only among them when it has changes of its own; the first one stands in otherwise
    const active = unsaved.findIndex((tab) => tab.id === activeTabId());
    return { tabs: unsaved.map(draftOfTab), active: Math.max(active, 0) };
  };

  const scheduleDraft = debounce(
    (session: DraftSession) => void desktop.invoke("draft:write", session),
    DRAFT_WRITE_DELAY,
  );

  const dropDraft = () => {
    scheduleDraft.clear();
    void desktop.invoke("draft:clear");
  };

  /** Keeps what is unsaved right now, for a window that closes before the delay of the draft ends. */
  const flushDraft = () => {
    const draft = currentDraft();
    scheduleDraft.clear();
    if (draft === undefined) return dropDraft();
    void desktop.invoke("draft:write", draft);
  };

  /**
   * Asks to save, discard or cancel the changes of one tab; `discard` means they are given up for
   * good, so the tab may not be kept in a draft any more.
   */
  const confirmCloseTab = async (tab: Tab): Promise<boolean> => {
    if (!isTabDirty(tab)) return true;
    const choice = await desktop.invoke("dialog:confirm-unsaved", tabFileName(tab));
    if (choice === "save") return saveTab(tab.id);
    if (choice !== "discard") return false;
    patchTab(tab.id, { discarded: true });
    return true;
  };

  /**
   * Before the window closes, asks about every tab with unsaved changes; returns whether to
   * continue. The questions follow one another, because saving a tab may open a save dialog of its
   * own and a cancel keeps the window open.
   */
  const confirmDiscard = (): Promise<boolean> =>
    tabs()
      .filter(isTabDirty)
      .reduce<Promise<boolean>>(
        (previous, tab) => previous.then((confirmed) => confirmed && confirmCloseTab(tab)),
        Promise.resolve(true),
      );

  /** Closes one tab, asking first about its unsaved changes; the next one takes its place and the last leaves the welcome screen. */
  const closeTab = async (id: number) => {
    const index = tabs().findIndex((tab) => tab.id === id);
    const tab = tabs()[index];
    if (tab === undefined) return;
    if (!(await confirmCloseTab(tab))) return;
    tab.pendingImages.dispose();
    const closed = tabs().filter((candidate) => candidate.id !== id);
    batch(() => {
      setTabs(closed);
      if (activeTabId() !== id) return;
      // The tab that took its place, or the one before when it was the last
      setActiveTabId(closed[Math.min(index, closed.length - 1)]?.id);
    });
  };

  const activateTab = (id: number) => {
    if (tabs().some((tab) => tab.id === id)) setActiveTabId(id);
  };

  /** Moves the active tab by `step`, wrapping around; one tab has nowhere to go. */
  const cycleTab = (step: number) => {
    const open = tabs();
    if (open.length < 2) return;
    const index = open.findIndex((tab) => tab.id === activeTabId());
    const next = open[(index + step + open.length) % open.length];
    if (next !== undefined) setActiveTabId(next.id);
  };

  const nextTab = () => cycleTab(1);
  const previousTab = () => cycleTab(-1);

  const newDocument = () => addTab(inMemoryDocument(false), "");

  const open = async () => {
    const opened = await desktop.invoke("document:open");
    if (opened) showOpened(opened);
  };

  /** Returns the failure message when the file can't be opened; with `showError` the user is also told in a dialog. */
  const openPath = async (path: string, showError = true): Promise<string | undefined> => {
    const alreadyOpen = tabOfPath(path);
    if (alreadyOpen !== undefined) {
      setActiveTabId(alreadyOpen.id);
      return undefined;
    }
    try {
      const opened = await desktop.invoke("document:read", path);
      // Null: the user gave up on the encoding of a file that is not UTF-8
      if (opened !== null) showOpened(opened);
      return undefined;
    } catch (error) {
      const message = messageOf(error);
      if (showError) {
        await reportFailure(t().dialogs.openFailed, path, message);
      }
      return message;
    }
  };

  const openSample = () => {
    const sample = tabs().find((tab) => tab.doc.isSample);
    if (sample !== undefined) {
      setActiveTabId(sample.id);
      return;
    }
    addTab(inMemoryDocument(true), getSampleDocument(currentLocale()));
  };

  /**
   * The tabs that were open when the app went away, each brought back with the version that was on
   * disk: they open with the same unsaved changes they had, and the one being edited comes up.
   */
  const restoreDraft = async (session: DraftSession) => {
    const restored = await Promise.all(
      session.tabs.map(async (draft) => {
        // The draft keeps the text as it was typed, while a save writes the file with a trailing
        // newline, so only the file itself tells whether a save has to ask about a change elsewhere
        const onDisk =
          draft.path === undefined
            ? undefined
            : await desktop.invoke(
                "document:peek",
                draft.path,
                MAX_CONFLICT_CHECK_BYTES,
                draft.encoding,
              );
        const tab: Tab = {
          id: nextTabId++,
          doc: {
            id: nextDocumentId++,
            path: draft.path,
            folder: draft.folder,
            baseUrl: draft.baseUrl,
            lineEnding: draft.lineEnding,
            encoding: draft.encoding,
            isSample: draft.isSample,
          },
          markdown: draft.markdown,
          savedMarkdown: draft.savedMarkdown,
          missingOnDisk: false,
          diskContent: onDisk ?? "",
          discarded: false,
          pendingImages: createPendingImages(),
        };
        return tab;
      }),
    );
    batch(() => {
      setTabs(restored);
      setActiveTabId(restored[Math.min(session.active, restored.length - 1)]?.id);
    });
  };

  /**
   * When the window opens, what the user was editing comes back as tabs, then the file it was
   * launched with opens beside them, and a session with neither follows the "On startup" setting.
   */
  const restoreOnStartup = async () => {
    const draft = await desktop.invoke("draft:read").catch(() => null);
    if (draft) await restoreDraft(draft);
    const { launchFile } = desktop.initialState;
    const { startup } = settings();
    const [lastFile] = recentFiles();
    // A file the window was opened with is what the user just asked for, so it comes to the front
    // with the recovered tabs behind it rather than being dropped for them
    if (launchFile !== undefined) void openPath(launchFile);
    else if (draft === null) {
      if (startup === "new-file") newDocument();
      else if (startup === "last-file" && lastFile !== undefined) void openPath(lastFile);
    }
    // From here on, a session without tabs means the user closed them, so its drafts are gone too
    setStartupDone(true);
  };

  /**
   * The editor now holds the text of the active tab: the saved version stays the one it was loaded
   * from, so a tab brought back from a draft still shows its unsaved changes.
   */
  const handleEditorReady = (markdown: string) => {
    const tab = activeTab();
    if (tab !== undefined) patchTab(tab.id, { markdown });
  };

  /** Called when the editor content changes; with auto save on, the files of every changed tab are written shortly after typing stops. */
  const handleMarkdownChange = (markdown: string) => {
    const tab = activeTab();
    if (tab === undefined) return;
    patchTab(tab.id, { markdown, discarded: false });
    if (settings().autoSave) scheduleSave();
  };

  let askingAboutDisk = false;

  /** Asks which version wins when the file differs from what its tab last saw; true means the caller may overwrite the file. */
  const resolveConflict = async (tab: Tab, disk: string, reload: () => void): Promise<boolean> => {
    if (askingAboutDisk) return false;
    askingAboutDisk = true;
    try {
      const choice = await desktop.invoke("dialog:confirm-external-change", tabFileName(tab));
      // Whatever the answer, this version of the file has been dealt with and does not ask again
      patchTab(tab.id, { diskContent: disk });
      if (choice === "reload") reload();
      return choice === "overwrite";
    } finally {
      askingAboutDisk = false;
    }
  };

  const reloadTab = async (id: number) => {
    const tab = tabs().find((candidate) => candidate.id === id);
    const path = tab?.doc.path;
    if (tab === undefined || path === undefined) return;
    const opened = await desktop.invoke("document:read", path).catch(() => undefined);
    if (!opened) return;
    showReloaded(tab, opened);
  };

  /** Applies an edit made to the file elsewhere; a tab with unsaved changes of its own asks which version to keep. */
  const handleDiskChange = async (path: string) => {
    if (askingAboutDisk || tabOfPath(path) === undefined) return;
    const opened = await desktop.invoke("document:read", path).catch(() => undefined);
    // The tab may have been closed while the file was read
    const tab = tabOfPath(path);
    if (tab === undefined) return;
    if (!opened) return handleDeletion(path);
    // The file is back, so what is on disk decides again whether there are unsaved changes
    const back = { ...tab, missingOnDisk: false };
    patchTab(back.id, { missingOnDisk: false });
    if (opened.content === back.diskContent) return;

    const reload = () => showReloaded(back, opened);
    if (!isTabDirty(back)) return reload();
    if (await resolveConflict(back, opened.content, reload)) await saveTab(back.id);
  };

  const handleDeletion = async (path: string) => {
    const tab = tabOfPath(path);
    if (tab === undefined || tab.missingOnDisk) return;
    if (await desktop.invoke("document:exists", path)) return;
    askingAboutDisk = true;
    try {
      const choice = await desktop.invoke("dialog:confirm-deleted", tabFileName(tab));
      if (choice === "save") await saveTab(tab.id);
      else patchTab(tab.id, { missingOnDisk: true });
    } finally {
      askingAboutDisk = false;
    }
  };

  /** Follows a file that was renamed in the folder tree: the tab keeps its text and history, only where it lives changes. */
  const handleRename = async (oldPath: string, newPath: string) => {
    const tab = tabOfPath(oldPath);
    if (tab === undefined) return;
    const location = await desktop.invoke("path:locate", newPath);
    patchTab(tab.id, { doc: { ...tab.doc, ...location } });
  };

  // Every open file is watched, not only the one being shown: a change elsewhere reaches the tab
  // that holds it, which then asks what to do with the version it has. Typing replaces the array of
  // tabs on every keystroke, while only opening, closing or moving one changes what is watched.
  const watchedPaths = createMemo(
    () => tabs().flatMap((tab) => (tab.doc.path === undefined ? [] : [tab.doc.path])),
    undefined,
    {
      equals: (previous, next) =>
        previous.length === next.length && previous.every((path, index) => path === next[index]),
    },
  );
  let watched = new Set<string>();
  createEffect(() => {
    const paths = new Set(watchedPaths());
    for (const path of paths) if (!watched.has(path)) void desktop.invoke("document:watch", path);
    for (const path of watched) if (!paths.has(path)) void desktop.invoke("document:unwatch", path);
    watched = paths;
  });
  const unlistenChanges = desktop.on("document:changed", (path) => void handleDiskChange(path));
  onCleanup(() => {
    unlistenChanges();
    for (const path of watched) void desktop.invoke("document:unwatch", path);
    watched = new Set();
  });

  // The example document follows the interface language while it is unmodified
  createEffect(
    on(
      currentLocale,
      (locale) => {
        const markdown = getSampleDocument(locale);
        for (const tab of tabs()) {
          if (!tab.doc.isSample || isTabDirty(tab)) continue;
          patchTab(tab.id, {
            doc: { ...tab.doc, id: nextDocumentId++ },
            markdown,
            savedMarkdown: markdown,
          });
        }
      },
      { defer: true },
    ),
  );

  // The draft holds every tab with unsaved changes: written once typing pauses, and dropped as soon
  // as no tab has any left, so a crash never brings back what is already on disk
  createEffect(() => {
    if (!startupDone()) return;
    const draft = currentDraft();
    if (draft === undefined) return dropDraft();
    scheduleDraft(draft);
  });

  return {
    tabs,
    activeTab,
    activeDocument,
    isDirty,
    hasDirtyTabs,
    fileName,
    tabFileName,
    handleEditorReady,
    handleMarkdownChange,
    save,
    saveAs,
    newDocument,
    open,
    openPath,
    openSample,
    closeTab,
    activateTab,
    nextTab,
    previousTab,
    handleRename,
    restoreOnStartup,
    confirmDiscard,
    flushDraft,
    dispose: () => {
      scheduleSave.clear();
      flushDraft();
      for (const tab of tabs()) tab.pendingImages.dispose();
    },
  };
}
