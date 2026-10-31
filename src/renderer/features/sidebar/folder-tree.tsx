import { ContextMenu } from "@kobalte/core/context-menu";
import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSelector,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
} from "solid-js";
import type { FolderEntry } from "@shared/desktop-api";
import { messageOf } from "@shared/errors";
import type { MenuEntry } from "@shared/menu";
import { isInsideFolder, relativeToFolder } from "@shared/paths";
import { MenuEntries } from "@/components/menu-popup";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { reportFailure } from "@/lib/errors";
import { FLOATING_PANEL, menuPanel } from "@/lib/styles";
import { cx } from "@/styled-system/css";
import { FolderChildren, FolderRow, type RowMenu, type TreeContext } from "./folder-tree-rows";
import { divider, sectionLabel, stack, treeRoot } from "./folder-tree-styles";

interface FolderTreeProps {
  root: string;
  activePath: string | undefined;
  /** Resolves to the failure message when the file can't be opened as text. */
  onOpenFile: (path: string) => Promise<string | undefined>;
  /** Opens a folder as the tree's root. */
  onOpenFolder: (path: string) => void;
  /** Tells the window that a document or a folder root moved, so the open document follows it. */
  onPathChanged?: (oldPath: string, newPath: string) => void;
  /** Tells the window that a menu or the rename field holds the sidebar, so the immersive chrome stays put. */
  onHoldOpenChange?: (open: boolean) => void;
  /** Tells the window whether a level on show holds a hidden entry. */
  onHiddenChange?: (hidden: boolean) => void;
}

/** A copy of `set` with `item` present or absent; the same set when it already is that way. */
function withMember<T>(set: ReadonlySet<T>, item: T, present: boolean): ReadonlySet<T> {
  if (set.has(item) === present) return set;
  const next = new Set(set);
  if (present) next.add(item);
  else next.delete(item);
  return next;
}

interface PathChange {
  old: string;
  path: string;
}

export const FolderTree: Component<FolderTreeProps> = (props) => {
  const [failures, setFailures] = createSignal<Readonly<Record<string, string>>>({});
  const [renaming, setRenaming] = createSignal<string>();
  const [expanded, setExpanded] = createSignal<ReadonlySet<string>>(new Set());
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [hiddenFolders, setHiddenFolders] = createSignal<ReadonlySet<string>>(new Set());
  const [pins, { refetch: refetchPins }] = createResource(
    () => props.root,
    (root) => desktop.invoke("folder:pins", root),
  );
  const pinnedPaths = createMemo(() => new Set((pins() ?? []).map((entry) => entry.path)));
  const pinnedEntries = () => pins() ?? [];
  // Each row subscribes to its own boolean, so opening another document touches two rows, not the tree
  const rowIsActive = createSelector(() => props.activePath);
  const reportHidden = (path: string, hidden: boolean) => {
    setHiddenFolders((current) => withMember(current, path, hidden));
  };
  createEffect(() => props.onHiddenChange?.(hiddenFolders().size > 0));
  onCleanup(() => props.onHiddenChange?.(false));
  // The rename field lives in the sidebar too: folding it away under the field would drop the name
  // being typed and cancel the rename
  const heldOpen = () => menuOpen() || renaming() !== undefined;
  createEffect(
    on(heldOpen, (open) => {
      props.onHoldOpenChange?.(open);
      onCleanup(() => props.onHoldOpenChange?.(false));
    }),
  );

  const openFile = async (path: string) => {
    const message = await props.onOpenFile(path);
    setFailures((current) => {
      const { [path]: _previous, ...rest } = current;
      return message === undefined ? rest : { ...rest, [path]: message };
    });
  };

  /** Runs a file action; a document or a folder root that moved is reported to the window. */
  const run = async (action: () => Promise<PathChange | undefined>) => {
    try {
      const changed = await action();
      if (changed !== undefined) props.onPathChanged?.(changed.old, changed.path);
    } catch (error) {
      const message = messageOf(error);
      await reportFailure(t().dialogs.fileActionFailed, message);
    }
  };

  const rename = (path: string, name: string) => {
    setRenaming(undefined);
    void run(async () => {
      const next = await desktop.invoke("path:rename", path, name);
      await movePins(path, next);
      return { old: path, path: next };
    });
  };

  // A new entry is named right away, so the folder it went into is opened for its row to show the field
  const create = (parent: string, kind: FolderEntry["kind"]) =>
    void run(async () => {
      const name = kind === "directory" ? t().sidebar.newFolder : t().common.untitledFileName;
      const path = await desktop.invoke("folder:create", parent, name, kind);
      setExpanded((current) => withMember(current, parent, true));
      setRenaming(path);
      return undefined;
    });

  /** Runs an action whose success changes nothing in this window; only its failure is reported. */
  const perform = (action: () => Promise<unknown>) =>
    void run(async () => {
      await action();
      return undefined;
    });

  /** Replaces the pins of the folder, in the form the pins file keeps them. */
  const setPins = async (paths: readonly string[]) => {
    await desktop.invoke("folder:set-pins", props.root, paths);
    await refetchPins();
  };

  const togglePin = (entry: FolderEntry) => {
    const key = relativeToFolder(props.root, entry.path);
    if (key === undefined) return;
    const current = pins() ?? [];
    const next = current.some((pin) => pin.path === entry.path)
      ? current.filter((pin) => pin.path !== entry.path).map((pin) => pin.relative)
      : [...current.map((pin) => pin.relative), key];
    perform(() => setPins(next));
  };

  /** Keeps a pin on a file or folder that was renamed, and on the pins under a renamed folder. */
  const movePins = async (oldPath: string, newPath: string) => {
    const current = pins() ?? [];
    let changed = false;
    const next = current.flatMap((pin) => {
      if (pin.path !== oldPath && !isInsideFolder(oldPath, pin.path)) {
        return [pin.relative];
      }
      changed = true;
      const key = relativeToFolder(props.root, `${newPath}${pin.path.slice(oldPath.length)}`);
      return key === undefined ? [] : [key];
    });
    if (changed) await setPins(next);
  };

  const removePins = async (path: string) => {
    const current = pins() ?? [];
    const next = current
      .filter((pin) => pin.path !== path && !isInsideFolder(path, pin.path))
      .map((pin) => pin.relative);
    if (next.length !== current.length) await setPins(next);
  };

  const trash = (path: string) =>
    void run(async () => {
      await desktop.invoke("path:trash", path);
      await removePins(path);
      return undefined;
    });
  const reveal = (path: string) => perform(() => desktop.invoke("path:reveal", path));
  const copyPath = (path: string) => perform(() => desktop.invoke("clipboard:write-text", path));

  const menuOf = (entry: FolderEntry): RowMenu => {
    const actions = new Map<string, () => void>();
    const item = (id: string, label: string, act: () => void): MenuEntry => {
      actions.set(id, act);
      return { type: "item", id, label };
    };
    const separator: MenuEntry = { type: "separator" };
    const renameItem = item("rename", t().sidebar.rename, () => setRenaming(entry.path));
    const trashItem = item("trash", t().sidebar.moveToTrash, () => trash(entry.path));
    const pathItems = [
      item("reveal", t().sidebar.showInFolder, () => reveal(entry.path)),
      item("copy-path", t().sidebar.copyPath, () => copyPath(entry.path)),
    ];
    const pinItem =
      entry.path === props.root
        ? undefined
        : item("pin", pinnedPaths().has(entry.path) ? t().sidebar.unpin : t().sidebar.pin, () =>
            togglePin(entry),
          );
    const entries: MenuEntry[] =
      entry.kind === "directory"
        ? [
            item("new-file", t().menu.newFile, () => create(entry.path, "file")),
            item("new-folder", t().sidebar.newFolder, () => create(entry.path, "directory")),
            separator,
            ...(pinItem === undefined ? [] : [pinItem, separator]),
            renameItem,
            separator,
            ...pathItems,
            separator,
            trashItem,
          ]
        : [
            renameItem,
            separator,
            ...pathItems,
            ...(pinItem === undefined ? [] : [separator, pinItem]),
            separator,
            trashItem,
          ];
    return { entries, actions };
  };

  const tree: TreeContext = {
    isActive: (path) => rowIsActive(path),
    failures,
    onOpenFile: (path) => void openFile(path),
    isExpanded: (path) => expanded().has(path),
    onToggleExpanded: (path) =>
      setExpanded((current) => withMember(current, path, !current.has(path))),
    onOpenFolder: (path) => props.onOpenFolder(path),
    renaming,
    onRename: rename,
    onRenameCancel: () => setRenaming(undefined),
    menuOf,
    onMenuOpenChange: setMenuOpen,
    onLevelHiddenChange: reportHidden,
    pinned: pinnedPaths,
    onTogglePin: togglePin,
  };

  return (
    // The empty space of the tree stands for the folder it shows, so a file can be created at its
    // root; it reaches the bottom of the sidebar, so the native menu does not take over there
    <ContextMenu onOpenChange={setMenuOpen}>
      <ContextMenu.Trigger as="div" class={treeRoot}>
        <Show when={pinnedEntries().length > 0}>
          <div class={stack}>
            <div class={sectionLabel}>{t().sidebar.pinned}</div>
            <For each={pinnedEntries()}>
              {(entry) => (
                <FolderRow entry={entry} depth={0} tree={tree} previews={() => undefined} />
              )}
            </For>
          </div>
          <div class={divider} />
        </Show>
        <FolderChildren path={props.root} depth={0} tree={tree} />
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content class={cx(FLOATING_PANEL, menuPanel)}>
          {(() => {
            const menu = menuOf({ name: props.root, path: props.root, kind: "directory" });
            return (
              <MenuEntries
                entries={menu.entries}
                onSelect={(item) => menu.actions.get(item.id)?.()}
              />
            );
          })()}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu>
  );
};
