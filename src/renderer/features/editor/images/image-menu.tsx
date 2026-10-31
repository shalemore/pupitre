import type { EditorView } from "@codemirror/view";
import type { Component } from "solid-js";
import { render } from "solid-js/web";
import { messageOf } from "@shared/errors";
import type { MenuEntry } from "@shared/menu";
import { LocaleProvider } from "@/components/locale-provider";
import { MenuPopup } from "@/components/menu-popup";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { reportFailure } from "@/lib/errors";
import { saveImageNextTo } from "@/lib/image-files";
import {
  type DocumentImage,
  dataImageFile,
  documentFilePath,
  documentFolder,
  imageAddress,
  imageAt,
  imageOrigin,
  relinkImage,
} from "@/lib/markdown/images";
import { pointerAnchor } from "@/lib/menu-anchor";

/**
 * The menu a right-click on a picture opens: what can be done with the file behind it, the way
 * Typora offers it. An action that moves the file rewrites the address of that one picture, so the
 * order of the document, its alt text and its size stay as they were; the selection is left alone,
 * so the picture goes on showing itself rather than its source.
 */

/** The entries of the menu and what each one runs. */
interface PictureMenu {
  readonly entries: readonly MenuEntry[];
  readonly actions: ReadonlyMap<string, () => void>;
}

/** Runs an action that may fail, telling the user what stopped it rather than leaving it silent. */
function attempt(run: () => Promise<void>): () => void {
  return () =>
    void run().catch((error: unknown) =>
      reportFailure(t().dialogs.fileActionFailed, messageOf(error)),
    );
}

/** What the menu of `image` holds; undefined when the file behind it is out of reach of any action. */
function pictureMenu(view: EditorView, image: DocumentImage): PictureMenu | undefined {
  const labels = t().editor.imageFile;
  const actions = new Map<string, () => void>();
  const item = (id: string, label: string, run: () => void): MenuEntry => {
    actions.set(id, run);
    return { type: "item", id, label };
  };

  const folder = documentFolder(view.state);
  if (folder === undefined) {
    // Without a file the document has no folder to move a picture into or out of
    return {
      entries: [{ type: "item", id: "unsaved", label: labels.unsaved, enabled: false }],
      actions,
    };
  }
  if (image.src.startsWith("data:")) {
    const documentPath = view.state.facet(documentFilePath);
    actions.set(
      "save-data",
      attempt(async () => {
        if (documentPath === undefined) return;
        const file = dataImageFile(image.src, image.alt);
        if (file === undefined) return;
        const saved = await saveImageNextTo(documentPath, file);
        relinkImage(view, image, saved);
      }),
    );
    return {
      entries: [
        {
          type: "item",
          id: "save-data",
          label: labels.download,
          enabled: documentPath !== undefined,
        },
      ],
      actions,
    };
  }
  const origin = imageOrigin(folder, image.src);
  if (origin === undefined) return undefined;

  /** The address the picture is linked with once the file behind it sits at `path`. */
  const linkTo = (path: string) => relinkImage(view, image, imageAddress(folder, path));

  if (origin.kind === "remote") {
    const url = origin.url;
    return {
      entries: [
        item("copy-path", labels.copyPath, () => void desktop.invoke("clipboard:write-text", url)),
        item(
          "download",
          labels.download,
          attempt(async () => {
            const path = await desktop.invoke("image:download", url, folder);
            if (path !== null) linkTo(path);
          }),
        ),
      ],
      actions,
    };
  }

  const path = origin.path;
  return {
    entries: [
      item("reveal", labels.reveal, () => void desktop.invoke("path:reveal", path)),
      item("copy-path", labels.copyPath, () => void desktop.invoke("clipboard:write-text", path)),
      { type: "separator" },
      item(
        "save-as",
        labels.saveAs,
        attempt(async () => {
          const moved = await desktop.invoke("image:save-as", path);
          if (moved !== null) linkTo(moved);
        }),
      ),
      item(
        "move",
        labels.moveToImageFolder,
        attempt(async () => {
          const moved = await desktop.invoke("image:move", path, folder);
          if (moved !== null) linkTo(moved);
        }),
      ),
      item(
        "copy-to",
        labels.copyTo,
        attempt(async () => {
          const copied = await desktop.invoke("image:copy", path);
          if (copied !== null) linkTo(copied);
        }),
      ),
      { type: "separator" },
      // Removing the reference alone leaves the file behind in the image folder; this takes both,
      // so a picture that is no longer wanted does not become an orphan
      item("delete", t().sidebar.moveToTrash, () => {
        const source = view.state.sliceDoc(image.from, image.to);
        void desktop
          .invoke("path:trash", path)
          .then(() => {
            // The text may have changed while the file was being moved
            if (view.state.sliceDoc(image.from, image.to) !== source) return;
            view.dispatch({
              changes: { from: image.from, to: image.to },
              userEvent: "delete",
            });
          })
          .catch((error: unknown) => reportFailure(t().dialogs.fileActionFailed, messageOf(error)));
      }),
    ],
    actions,
  };
}

const PictureMenuPanel: Component<{
  menu: PictureMenu;
  anchor: DOMRect;
  onSelect: (id: string) => void;
  onClose: () => void;
}> = (props) => (
  <MenuPopup
    entries={props.menu.entries}
    anchor={props.anchor}
    onSelect={(entry) => props.onSelect(entry.id)}
    onClose={props.onClose}
  />
);

/**
 * Opens the file menu of the picture under a right-click at the pointer; returns whether the click
 * was on a picture that has such a menu, so that every other click keeps what the window gives it.
 */
export function openImageMenu(
  view: EditorView,
  event: MouseEvent,
  knownImage?: DocumentImage,
): boolean {
  const target = event.target;
  if (!(target instanceof Element) || target.closest(".md-image-preview") === null) return false;
  let image = knownImage;
  if (image === undefined) {
    const pos = view.posAtCoords(event);
    if (pos === null) return false;
    image = imageAt(view.state, pos) ?? imageAt(view.state, Math.max(pos - 1, 0));
  }
  if (image === undefined) return false;
  const menu = pictureMenu(view, image);
  if (menu === undefined) return false;
  event.preventDefault();

  // The panel draws itself outside the editor, so a root of its own holds it until it closes. It
  // has to sit in the document: the root measures the trigger to place the panel, and a detached
  // one measures zero.
  const container = document.createElement("div");
  document.body.append(container);
  let dispose: (() => void) | undefined;
  const close = () => {
    dispose?.();
    dispose = undefined;
    container.remove();
  };
  dispose = render(
    () => (
      <LocaleProvider>
        <PictureMenuPanel
          menu={menu}
          anchor={pointerAnchor(event)}
          onSelect={(id) => {
            close();
            // The menu took the focus with it; the caret belongs back in the text
            view.focus();
            menu.actions.get(id)?.();
          }}
          onClose={close}
        />
      </LocaleProvider>
    ),
    container,
  );
  return true;
}
