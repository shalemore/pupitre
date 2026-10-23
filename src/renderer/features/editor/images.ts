import { type EditorState, type Extension, Facet, Transaction } from "@codemirror/state";
import { EditorView, WidgetType } from "@codemirror/view";

/** file:// URL of the document's folder, to resolve relative image paths; undefined if unsaved. */
export const documentBaseUrl = Facet.define<string | undefined, string | undefined>({
  combine: (values) => values[0],
});

/** `url` made absolute against the document's folder, when it is relative and there is one. */
export function resolveAgainst(base: string | undefined, url: string): string {
  if (!base || URL.canParse(url)) return url;
  return new URL(url, base).href;
}

export function resolveUrl(state: EditorState, url: string): string {
  return resolveAgainst(state.facet(documentBaseUrl), url);
}

/** The address inside an image's parentheses, without the optional angle brackets. */
export function imageSource(destination: string): string {
  return destination.replace(/^<(.*)>$/, "$1");
}

export class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
  ) {
    super();
  }

  override eq(other: ImageWidget): boolean {
    return other.src === this.src && other.alt === this.alt;
  }

  toDOM(view: EditorView): HTMLElement {
    const image = document.createElement("img");
    image.className = "md-image-preview";
    image.src = this.src;
    image.alt = this.alt;
    // The line grows once the picture arrives; let CodeMirror measure it again
    image.addEventListener("load", () => view.requestMeasure());
    return image;
  }

  // Clicking the picture places the cursor there, which reveals its source
  override ignoreEvent(): boolean {
    return false;
  }
}

function imageFiles(data: DataTransfer | null): File[] {
  return [...(data?.files ?? [])].filter((file) => file.type.startsWith("image/"));
}

/**
 * Pasted and dropped pictures are stored by `upload`, which returns the address to link, and
 * inserted as Markdown images. Other dropped files are left to the window, which opens them.
 */
export function imageInput(upload: (file: File) => Promise<string>): Extension {
  const insert = async (view: EditorView, files: File[], pos: number) => {
    const sources = await Promise.all(files.map(upload));
    const text = sources.map((src) => `![](${/\s/.test(src) ? `<${src}>` : src})`).join("\n");
    const at = Math.min(pos, view.state.doc.length);
    view.dispatch({
      changes: { from: at, insert: text },
      selection: { anchor: at + text.length },
      userEvent: "input.paste",
    });
  };

  return EditorView.domEventHandlers({
    paste(event, view) {
      const files = imageFiles(event.clipboardData);
      if (files.length === 0) return false;
      event.preventDefault();
      const { from, to } = view.state.selection.main;
      if (to > from) view.dispatch({ changes: { from, to }, userEvent: "delete" });
      void insert(view, files, from);
      return true;
    },
    drop(event, view) {
      if (!event.dataTransfer?.files.length) return false;
      const files = imageFiles(event.dataTransfer);
      if (files.length === 0) return true;
      event.preventDefault();
      const pos = view.posAtCoords(event) ?? view.state.selection.main.head;
      void insert(view, files, pos);
      return true;
    },
  });
}

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

  return {
    add: (file: File): string => {
      const url = URL.createObjectURL(file);
      images.set(url, { file });
      return url;
    },

    /** Saves the images the document still shows next to `documentPath` and links them there. */
    persist: async (view: EditorView, documentPath: string): Promise<void> => {
      const before = view.state.doc.toString();
      const shown = [...images].filter(([url]) => before.includes(url));
      await Promise.all(
        shown.map(async ([, image]) => {
          if (image.saved?.documentPath === documentPath) return;
          image.saved = { documentPath, src: await saveImage(documentPath, image.file) };
        }),
      );
      // Read the document again: it may have changed while the files were written
      const text = view.state.doc.toString();
      const changes = shown.flatMap(([url, image]) => {
        const src = image.saved?.src;
        if (src === undefined) return [];
        const found = [];
        for (let at = text.indexOf(url); at >= 0; at = text.indexOf(url, at + url.length)) {
          found.push({ from: at, to: at + url.length, insert: src });
        }
        return found;
      });
      // Keep undo from bringing back the in-memory address; if it still does, the next save
      // links the image again
      view.dispatch({ changes, annotations: Transaction.addToHistory.of(false) });
    },

    dispose: () => {
      for (const url of images.keys()) URL.revokeObjectURL(url);
      images.clear();
    },
  };
}
