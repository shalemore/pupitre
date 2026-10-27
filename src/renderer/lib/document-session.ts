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
  /**
   * Whether the editor holds a change that is not saved. The text itself is read from the editor
   * when it is needed, so a keystroke does not copy a whole document into the session.
   */
  edited: boolean;
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

/** The text of a closed tab that had no file: nothing on disk holds it, so the closed tabs keep it whole. */
interface InMemoryTab extends Omit<OpenDocument, "id" | "path"> {
  markdown: string;
  /** What its text was compared to, so a reopened tab shows the unsaved changes it had. */
  savedMarkdown: string;
  /** The pictures its text links by blob: URL, kept alive for as long as the tab can come back. */
  pendingImages: PendingImages;
}

/**
 * A tab on its way back in, kept for File › Reopen Closed Tab. A document with a file is read again
 * when it reopens; one without a file exists nowhere else, so the text it was closed with comes along.
 */
type ClosedTab = { kind: "file"; path: string } | { kind: "in-memory"; text: InMemoryTab };

const SAMPLE_FILE_NAME = "Pupitre-Guide.md";
const AUTO_SAVE_DELAY = 1500;
// A dirty dot that an undo cleared should disappear without waiting for a save
const SAVED_CHECK_DELAY = 400;
// File › Reopen Closed Tab walks back through the tabs that were closed, and only so many are kept
const CLOSED_TAB_LIMIT = 20;
// A draft follows the pause after typing, not the keystrokes themselves; the main process writes it out a moment later
const DRAFT_WRITE_DELAY = 1000;
// A draft copies the text of every changed tab into the profile; a document this large would make
// every pause and every close write hundreds of megabytes, so it is not drafted at all
const MAX_DRAFT_CHARACTERS = 8 * 1024 * 1024;
// Comparing the whole document with the saved version after an undo is only cheap while it is small
const MAX_SAVED_CHECK_CHARACTERS = 8 * 1024 * 1024;
// Saving compares the file on disk with what was last read or written; bigger files skip the comparison to keep saving fast
const MAX_CONFLICT_CHECK_BYTES = 512 * 1024;
let nextDocumentId = 1;
let nextTabId = 1;

export const isTabDirty = (tab: Tab) => tab.edited || tab.missingOnDisk;

/**
 * The open tabs and the life cycle of the document in each: new, open, save, save as, close, and
 * the unsaved-changes prompt before a tab or the window goes. The editor holds the Markdown text of
 * the active tab; the caller provides it through getMarkdown.
 */
export function createDocumentSession(
  getEditor: () =>
    | Pick<MarkdownEditorHandle, "getMarkdown" | "getMarkdownLength" | "persistImages">
    | undefined,
) {
  const [tabs, setTabs] = createSignal<Tab[]>([]);
  const [activeTabId, setActiveTabId] = createSignal<number>();
  // Tabs in the order they were closed, so the last one is the next to come back
  const [closedTabs, setClosedTabs] = createSignal<ClosedTab[]>([]);
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

  /**
   * Copies the text of the tab on show out of the editor, before another tab hides it. Reading a
   * large document is expensive, so it happens when a tab is left or saved rather than on every
   * keystroke; until then `edited` is what says the text has changed.
   */
  const rememberActiveText = () => {
    const tab = activeTab();
    if (tab === undefined || !tab.edited) return;
    const editor = getEditor();
    if (editor === undefined) return;
    const markdown = editor.getMarkdown();
    const edited = markdown.length > MAX_SAVED_CHECK_CHARACTERS || markdown !== tab.savedMarkdown;
    patchTab(tab.id, { markdown, edited });
  };

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
   * to, which defaults to the text it is loaded with, so a tab starts out clean. `pendingImages`
   * lets a reopened tab adopt the pictures its text links, which only a closed tab still holds.
   */
  const addTab = (
    doc: Omit<OpenDocument, "id">,
    markdown: string,
    text: { savedMarkdown: string; diskContent: string } = {
      savedMarkdown: markdown,
      diskContent: "",
    },
    pendingImages: PendingImages = createPendingImages(),
  ) => {
    rememberActiveText();
    const id = nextTabId++;
    batch(() => {
      setTabs([
        ...tabs(),
        {
          id,
          doc: { ...doc, id: nextDocumentId++ },
          markdown,
          savedMarkdown: text.savedMarkdown,
          edited: markdown !== text.savedMarkdown,
          missingOnDisk: false,
          diskContent: text.diskContent,
          discarded: false,
          pendingImages,
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
      rememberActiveText();
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
      edited: false,
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
    patchTab(tab.id, { markdown, savedMarkdown: markdown, edited: false, missingOnDisk: false });
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

  // The dirty dot is normally cleared by a save; an undo can also bring the text back to the version
  // on disk. Comparing a whole document on every key would defeat the point, so the check waits for
  // the typing to stop and only runs for documents small enough to compare cheaply.
  const checkSaved = debounce(() => {
    const tab = activeTab();
    const editor = getEditor();
    if (tab === undefined || !tab.edited || editor === undefined) return;
    if (editor.getMarkdownLength() > MAX_SAVED_CHECK_CHARACTERS) return;
    if (editor.getMarkdown() === tab.savedMarkdown) patchTab(tab.id, { edited: false });
  }, SAVED_CHECK_DELAY);

  /** The text of a tab as a draft would keep it, or undefined when it is too large to copy. */
  const draftText = (tab: Tab): string | undefined => {
    const editor = tab.id === activeTabId() ? getEditor() : undefined;
    if (editor !== undefined) {
      if (editor.getMarkdownLength() > MAX_DRAFT_CHARACTERS) return undefined;
      return editor.getMarkdown();
    }
    return tab.markdown.length <= MAX_DRAFT_CHARACTERS ? tab.markdown : undefined;
  };

  /** One tab as a crash would leave it: the text being edited, and the version it is compared to. */
  const draftOfTab = (tab: Tab): Draft | undefined => {
    const markdown = draftText(tab);
    if (markdown === undefined) return undefined;
    return {
      path: tab.doc.path,
      folder: tab.doc.folder,
      baseUrl: tab.doc.baseUrl,
      markdown,
      savedMarkdown: tab.savedMarkdown,
      lineEnding: tab.doc.lineEnding,
      encoding: tab.doc.encoding,
      isSample: tab.doc.isSample,
    };
  };

  /** What a crash would bring back: every tab with unsaved changes, and which of them was being edited. */
  const currentDraft = (): DraftSession | undefined => {
    const unsaved = tabs()
      .filter((tab) => !tab.discarded && isTabDirty(tab))
      .map((tab) => ({ tab, draft: draftOfTab(tab) }))
      .filter((entry): entry is { tab: Tab; draft: Draft } => entry.draft !== undefined);
    if (unsaved.length === 0) return undefined;
    // The active tab is only among them when it has changes of its own; the first one stands in otherwise
    const active = unsaved.findIndex(({ tab }) => tab.id === activeTabId());
    return { tabs: unsaved.map(({ draft }) => draft), active: Math.max(active, 0) };
  };

  const writeDraft = debounce(() => {
    const draft = currentDraft();
    if (draft === undefined) {
      void desktop.invoke("draft:clear");
      return;
    }
    void desktop.invoke("draft:write", draft);
  }, DRAFT_WRITE_DELAY);

  const dropDraft = () => {
    writeDraft.clear();
    void desktop.invoke("draft:clear");
  };

  /** Keeps what is unsaved right now, for a window that closes before the delay of the draft ends. */
  const flushDraft = () => {
    const draft = currentDraft();
    writeDraft.clear();
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

  const canReopenTab = () => closedTabs().length > 0;

  /** Drops what a tab that will never come back still holds: the pictures of a text nobody shows. */
  const forgetClosedTab = (closed: ClosedTab) => {
    if (closed.kind === "in-memory") closed.text.pendingImages.dispose();
  };

  /** Keeps a tab that is being closed, so File › Reopen Closed Tab can bring it back. */
  const rememberClosedTab = (tab: Tab) => {
    const closed: ClosedTab =
      tab.doc.path === undefined
        ? {
            kind: "in-memory",
            text: {
              folder: tab.doc.folder,
              baseUrl: tab.doc.baseUrl,
              lineEnding: tab.doc.lineEnding,
              encoding: tab.doc.encoding,
              isSample: tab.doc.isSample,
              markdown: tab.markdown,
              savedMarkdown: tab.savedMarkdown,
              pendingImages: tab.pendingImages,
            },
          }
        : { kind: "file", path: tab.doc.path };
    // Once the stack is full the oldest tabs make room for the one just closed
    const kept = [...closedTabs(), closed];
    for (const gone of kept.slice(0, Math.max(kept.length - CLOSED_TAB_LIMIT, 0))) {
      forgetClosedTab(gone);
    }
    setClosedTabs(kept.slice(-CLOSED_TAB_LIMIT));
  };

  /** Closes one tab, asking first about its unsaved changes; the next one takes its place and the last leaves the welcome screen. */
  const closeTab = async (id: number) => {
    const index = tabs().findIndex((tab) => tab.id === id);
    const tab = tabs()[index];
    if (tab === undefined) return;
    // A text that exists nowhere else has to be captured before the editor stops showing it; a
    // file-backed tab is saved from the editor or read again when it reopens. A small file is
    // compared here as well, so an undo back to its saved version does not ask about changes.
    const editor = tab.id === activeTabId() ? getEditor() : undefined;
    const smallFile =
      editor !== undefined && editor.getMarkdownLength() <= MAX_SAVED_CHECK_CHARACTERS;
    if (tab.id === activeTabId() && (tab.doc.path === undefined || smallFile)) rememberActiveText();
    // Copying the text may have shown an undo back to the saved version, so ask about the tab as it is now
    const current = tabs().find((candidate) => candidate.id === id);
    if (current === undefined) return;
    // A close the user cancelled leaves no tab behind to bring back
    if (!(await confirmCloseTab(current))) return;
    // The prompt may have saved the tab under a path it did not have before, which replaces the tab
    // it was asked about: what comes back is the one the signal holds now, file and all
    const closedTab = tabs().find((candidate) => candidate.id === id);
    if (closedTab === undefined) return;
    // A file is read again when it reopens, so nothing of it is kept; a text that exists nowhere
    // else keeps its pictures too, or the links a later save writes would point at revoked URLs
    if (closedTab.doc.path !== undefined) closedTab.pendingImages.dispose();
    rememberClosedTab(closedTab);
    const closed = tabs().filter((candidate) => candidate.id !== id);
    batch(() => {
      setTabs(closed);
      if (activeTabId() !== id) return;
      // The tab that took its place, or the one before when it was the last
      setActiveTabId(closed[Math.min(index, closed.length - 1)]?.id);
    });
  };

  const activateTab = (id: number) => {
    if (id === activeTabId()) return;
    if (tabs().some((tab) => tab.id === id)) {
      rememberActiveText();
      setActiveTabId(id);
    }
  };

  /**
   * Brings the tab that was closed last back. Its file is read again, so a document changed or
   * deleted on disk comes back as it is now, or reports the failure the way opening it would.
   */
  const reopenTab = async () => {
    const closed = closedTabs().at(-1);
    if (closed === undefined) return;
    // The tab is spent even when its file cannot be read any more, so the next press reaches further back
    setClosedTabs(closedTabs().slice(0, -1));
    if (closed.kind === "file") {
      await openPath(closed.path);
      return;
    }
    const { text } = closed;
    // Reopening brings the text of a discarded close back as unsaved work rather than as a file, and
    // the pictures it links come with it, so a save of it writes the images it shows
    addTab(
      {
        path: undefined,
        folder: text.folder,
        baseUrl: text.baseUrl,
        lineEnding: text.lineEnding,
        encoding: text.encoding,
        isSample: text.isSample,
      },
      text.markdown,
      { savedMarkdown: text.savedMarkdown, diskContent: "" },
      text.pendingImages,
    );
  };

  /** Moves the active tab by `step`, wrapping around; one tab has nowhere to go. */
  const cycleTab = (step: number) => {
    const open = tabs();
    if (open.length < 2) return;
    const index = open.findIndex((tab) => tab.id === activeTabId());
    const next = open[(index + step + open.length) % open.length];
    if (next !== undefined) {
      rememberActiveText();
      setActiveTabId(next.id);
    }
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
      rememberActiveText();
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

  const openSample = async () => {
    const sample = tabs().find((tab) => tab.doc.isSample);
    if (sample !== undefined) {
      setActiveTabId(sample.id);
      return;
    }
    const markdown = await getSampleDocument(currentLocale());
    // Opening it twice while the document was loading still leaves one tab
    const opened = tabs().find((tab) => tab.doc.isSample);
    if (opened !== undefined) {
      setActiveTabId(opened.id);
      return;
    }
    addTab(inMemoryDocument(true), markdown);
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
          edited: draft.markdown !== draft.savedMarkdown,
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
  const handleMarkdownChange = () => {
    const tab = activeTab();
    if (tab === undefined) return;
    patchTab(tab.id, { edited: true, discarded: false });
    checkSaved();
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
        void getSampleDocument(locale)
          .then((markdown) => {
            // A later language change has its own load; this one no longer describes it
            if (currentLocale() !== locale) return;
            for (const tab of tabs()) {
              if (!tab.doc.isSample || isTabDirty(tab)) continue;
              patchTab(tab.id, {
                doc: { ...tab.doc, id: nextDocumentId++ },
                markdown,
                savedMarkdown: markdown,
                edited: false,
              });
            }
          })
          .catch(() => undefined);
      },
      { defer: true },
    ),
  );

  // The draft holds every tab with unsaved changes: written once typing pauses, and dropped as soon
  // as no tab has any left, so a crash never brings back what is already on disk
  createEffect(() => {
    if (!startupDone()) return;
    if (!tabs().some((tab) => !tab.discarded && isTabDirty(tab))) {
      dropDraft();
      return;
    }
    writeDraft();
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
    canReopenTab,
    reopenTab,
    activateTab,
    nextTab,
    previousTab,
    handleRename,
    restoreOnStartup,
    confirmDiscard,
    flushDraft,
    dispose: () => {
      scheduleSave.clear();
      checkSaved.clear();
      flushDraft();
      for (const tab of tabs()) tab.pendingImages.dispose();
    },
  };
}
