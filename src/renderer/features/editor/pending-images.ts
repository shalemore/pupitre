import type { EditorView } from "@milkdown/kit/prose/view";

interface PendingImage {
  file: File;
  /** Where the image was written, for the document path it was written for. */
  saved?: { documentPath: string; src: string };
}

/**
 * Images pasted into a document that has no file yet. They are shown from blob: URLs and written
 * to the image folder when the document is first saved, so an unsaved document never embeds image
 * data in its Markdown.
 */
export function createPendingImages(
  saveImage: (documentPath: string, file: File) => Promise<string>,
) {
  const images = new Map<string, PendingImage>();

  const pendingSources = (view: EditorView): Set<string> => {
    const sources = new Set<string>();
    view.state.doc.descendants((node) => {
      const src: unknown = node.attrs["src"];
      if (typeof src === "string" && images.has(src)) sources.add(src);
    });
    return sources;
  };

  return {
    add: (file: File): string => {
      const url = URL.createObjectURL(file);
      images.set(url, { file });
      return url;
    },

    /** Saves the images the document still shows next to `documentPath` and links them there. */
    persist: async (view: EditorView, documentPath: string): Promise<void> => {
      const sources = pendingSources(view);
      if (sources.size === 0) return;
      await Promise.all(
        [...sources].map(async (url) => {
          const image = images.get(url);
          if (!image || image.saved?.documentPath === documentPath) return;
          image.saved = { documentPath, src: await saveImage(documentPath, image.file) };
        }),
      );
      // Read the document again: it may have changed while the files were written
      const { tr } = view.state;
      view.state.doc.descendants((node, pos) => {
        const src: unknown = node.attrs["src"];
        const saved = typeof src === "string" ? images.get(src)?.saved : undefined;
        if (saved?.documentPath === documentPath) tr.setNodeAttribute(pos, "src", saved.src);
      });
      // Keep undo from bringing back the in-memory address; if an earlier step still does, the
      // next save links the image again
      view.dispatch(tr.setMeta("addToHistory", false));
    },

    dispose: () => {
      for (const url of images.keys()) URL.revokeObjectURL(url);
      images.clear();
    },
  };
}
