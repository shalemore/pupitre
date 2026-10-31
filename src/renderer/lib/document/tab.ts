import { IMAGE_FILE, type LineEnding, type TextEncoding } from "@shared/desktop-api";
import type { PendingImages } from "@/lib/pending-images";

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

export const isTabDirty = (tab: Tab) => tab.edited || tab.missingOnDisk;

/** A tab that shows a picture: it holds no text, so it is never saved, drafted, searched or formatted. */
export const isImageTab = (tab: Tab) => tab.doc.path !== undefined && IMAGE_FILE.test(tab.doc.path);
