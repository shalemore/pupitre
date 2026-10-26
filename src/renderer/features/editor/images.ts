import { type EditorState, type Extension, Facet, Transaction } from "@codemirror/state";
import { EditorView, WidgetType } from "@codemirror/view";
import { desktop } from "@/lib/desktop";

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

/** Writes a pasted or dropped picture next to `documentPath` and returns the address to link it. */
export async function saveImageNextTo(documentPath: string, file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return desktop.invoke("document:save-image", documentPath, file.name, bytes);
}

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
