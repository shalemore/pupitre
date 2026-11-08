import { messageOf } from "@shared/errors";
import type { MarkdownEditorHandle } from "@/features/editor/markdown-editor";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import type { DocumentSession } from "@/lib/document/session";
import { reportFailure } from "@/lib/errors";
import { withoutDocumentExtension } from "@/lib/file";
import { withoutScripts } from "@/lib/html";

/**
 * What the window does with a document as a whole: printing it with every construct rendered, and
 * putting it on the clipboard or on disk as HTML or an image.
 */
export interface DocumentActions {
  copyAsHtml: () => Promise<void>;
  exportPdf: () => Promise<void>;
  printDocument: () => Promise<void>;
  exportDocument: (format: "html" | "image") => Promise<void>;
  pastePlainText: () => Promise<void>;
}

export function createDocumentActions(
  session: DocumentSession,
  editor: () => MarkdownEditorHandle | undefined,
  activeIsImage: () => boolean,
): DocumentActions {
  /** Runs `run` with the whole document rendered, which printing and exporting need, and puts it back. */
  const whilePrinting = async (run: () => Promise<unknown>) => {
    const resume = await editor()?.prepareForPrint();
    try {
      await run();
    } finally {
      resume?.();
    }
  };

  const exportPdf = async () => {
    if (!session.activeDocument() || activeIsImage()) return;
    const pdfName = withoutDocumentExtension(session.fileName()) + ".pdf";
    await whilePrinting(() => desktop.invoke("document:export-pdf", pdfName));
  };

  const printDocument = async () => {
    if (activeIsImage()) return;
    await whilePrinting(() => desktop.invoke("document:print"));
  };

  /** Writes the document as the page the editor would show, as a web page or as one tall image. */
  const exportDocument = async (format: "html" | "image") => {
    const doc = session.activeDocument();
    if (!doc) return;
    const html = await editor()?.toHtml();
    if (html === undefined) return;
    const name =
      withoutDocumentExtension(session.fileName()) + (format === "html" ? ".html" : ".png");
    try {
      await (format === "html"
        ? desktop.invoke("document:export-html", name, html)
        : desktop.invoke("document:export-image", name, withoutScripts(html), doc.folder));
    } catch (error) {
      await reportFailure(t().dialogs.saveFailed, name, messageOf(error));
    }
  };

  /** Inserts the clipboard's text where it is being typed, leaving its formatting behind. */
  const pastePlainText = async () => {
    // A browser can refuse the clipboard read; there is nothing to insert then
    const text = await desktop.invoke("clipboard:read-text").catch(() => "");
    if (text === "") return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      const start = active.selectionStart ?? active.value.length;
      const end = active.selectionEnd ?? start;
      active.setRangeText(text, start, end, "end");
      active.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    editor()?.pastePlainText(text);
  };

  /** Puts the selection, or the whole document when nothing is selected, on the clipboard as rich text. */
  const copyAsHtml = async () => {
    const fragment = await editor()?.toHtmlFragment();
    if (fragment === undefined) return;
    await desktop.invoke("clipboard:write-rich", fragment.markdown, fragment.html);
  };

  return { copyAsHtml, exportDocument, exportPdf, pastePlainText, printDocument };
}
