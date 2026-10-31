import { debounce } from "@solid-primitives/scheduled";
import type { Draft, DraftSession } from "@shared/desktop-api";
import { desktop } from "@/lib/desktop";
import type { DocumentEditor } from "@/lib/document-editor";
import { isImageTab, isTabDirty, type Tab } from "@/lib/document-tab";

// A draft follows the pause after typing, not the keystrokes themselves; the main process writes it out a moment later
const DRAFT_WRITE_DELAY = 1000;
// A draft copies the text of every changed tab into the profile; a document this large would make
// every pause and every close write hundreds of megabytes, so it is not drafted at all
const MAX_DRAFT_CHARACTERS = 8 * 1024 * 1024;

type DraftEditor = DocumentEditor;

/** What a draft reads: the open tabs and, for the one on show, the editor that holds its latest text. */
export interface DraftSource {
  tabs: () => readonly Tab[];
  activeTabId: () => number | undefined;
  editor: () => DraftEditor | undefined;
}

/**
 * Keeps the tabs with unsaved changes in the draft the main process writes into the profile, so a
 * crash leaves something to offer back when the window opens again.
 */
export function createDocumentDrafts(source: DraftSource) {
  /** The text of a tab as a draft would keep it, or undefined when it is too large to copy. */
  const draftText = (tab: Tab): string | undefined => {
    const editor = tab.id === source.activeTabId() ? source.editor() : undefined;
    if (editor !== undefined) {
      if (editor.getMarkdownLength() > MAX_DRAFT_CHARACTERS) return undefined;
      return editor.getMarkdown();
    }
    return tab.markdown.length <= MAX_DRAFT_CHARACTERS ? tab.markdown : undefined;
  };

  /** One tab as a crash would leave it: the text being edited, and the version it is compared to. */
  const draftOfTab = (tab: Tab): Draft | undefined => {
    if (isImageTab(tab)) return undefined;
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
    const unsaved = source
      .tabs()
      .filter((tab) => !tab.discarded && isTabDirty(tab))
      .map((tab) => ({ tab, draft: draftOfTab(tab) }))
      .filter((entry): entry is { tab: Tab; draft: Draft } => entry.draft !== undefined);
    if (unsaved.length === 0) return undefined;
    // The active tab is only among them when it has changes of its own; the first one stands in otherwise
    const active = unsaved.findIndex(({ tab }) => tab.id === source.activeTabId());
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

  return { dropDraft, flushDraft, writeDraft };
}
