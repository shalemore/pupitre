import { Transaction } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { saveImageNextTo } from "@/lib/image-files";

interface PendingImage {
  file: File;
  /** Where the image was written, for the document path it was written for. */
  saved?: { documentPath: string; src: string };
}

/** A written image, by the blob: URL the document still links it with. */
interface ShownImage {
  url: string;
  src: string;
}

interface LinkChange {
  from: number;
  to: number;
  insert: string;
}

/** Every place in `text` that still shows the image by its blob: URL. */
function linkChanges(text: string, shown: readonly ShownImage[]): LinkChange[] {
  return shown.flatMap(({ url, src }) => {
    const changes: LinkChange[] = [];
    for (let at = text.indexOf(url); at >= 0; at = text.indexOf(url, at + url.length)) {
      changes.push({ from: at, to: at + url.length, insert: src });
    }
    return changes;
  });
}

/** `text` with every picture it still shows under a blob: URL linked to where it was written. */
function withWrittenImages(text: string, shown: readonly ShownImage[]): string {
  // Applied from the end, so no change moves the place of the ones before it
  return linkChanges(text, shown)
    .toSorted((a, b) => b.from - a.from)
    .reduce(
      (result, { from, to, insert }) => result.slice(0, from) + insert + result.slice(to),
      text,
    );
}

export interface PendingImages {
  /** Keeps `file` in memory and returns the blob: URL showing it until the document is written. */
  add: (file: File) => string;
  /**
   * Writes the images `markdown` still shows next to `documentPath`; returns the text linking them
   * there. The session writes a tab that is not on show with it, without the editor that shows it.
   */
  persistText: (markdown: string, documentPath: string) => Promise<string>;
  /** The same for the document an editor shows, linking the written images in place. */
  persistView: (view: EditorView, documentPath: string) => Promise<void>;
  dispose: () => void;
}

/**
 * Images pasted into a document that has no file yet. They are shown from blob: URLs and written
 * to the image folder when the document is first saved, so an unsaved document never embeds image
 * data in its Markdown.
 */
export function createPendingImages(): PendingImages {
  const images = new Map<string, PendingImage>();

  /** Writes the images `markdown` still shows, each once for the document path it belongs to. */
  const writeShown = async (markdown: string, documentPath: string): Promise<ShownImage[]> => {
    const shown = [...images].filter(([url]) => markdown.includes(url));
    return Promise.all(
      shown.map(async ([url, image]) => {
        const saved =
          image.saved?.documentPath === documentPath
            ? image.saved
            : { documentPath, src: await saveImageNextTo(documentPath, image.file) };
        image.saved = saved;
        return { url, src: saved.src };
      }),
    );
  };

  return {
    add: (file: File): string => {
      const url = URL.createObjectURL(file);
      images.set(url, { file });
      return url;
    },

    persistText: async (markdown, documentPath) => {
      const shown = await writeShown(markdown, documentPath);
      return withWrittenImages(markdown, shown);
    },

    persistView: async (view, documentPath) => {
      const before = view.state.doc.toString();
      const shown = await writeShown(before, documentPath);
      // Read the document again: it may have changed while the files were written
      const text = view.state.doc.toString();
      // Keep undo from bringing back the in-memory address; if it still does, the next save
      // links the image again
      view.dispatch({
        changes: linkChanges(text, shown),
        annotations: Transaction.addToHistory.of(false),
      });
    },

    dispose: () => {
      for (const url of images.keys()) URL.revokeObjectURL(url);
      images.clear();
    },
  };
}
