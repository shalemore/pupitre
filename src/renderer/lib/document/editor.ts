/**
 * The part of the editor the document session reads. It is declared here rather than imported
 * from the editor so that the session depends on what it needs, not on the editor's whole handle;
 * the handle the editor exposes satisfies it.
 */
export interface DocumentEditor {
  getMarkdown: () => string;
  getMarkdownLength: () => number;
}

/** What saving a document reads from the editor besides its text. */
export interface DocumentEditorWithImages extends DocumentEditor {
  persistImages: (documentPath: string) => Promise<void>;
}
