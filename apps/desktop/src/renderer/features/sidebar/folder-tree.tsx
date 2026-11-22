import type { FolderEntry } from "@pupitre/desktop-api";
import { desktop } from "@pupitre/desktop-api/client";
import type { MenuEntry } from "@pupitre/desktop-api/menu";
import { t } from "@pupitre/i18n/solid";
import { ListItem, rowIndent } from "@pupitre/ui";
import { messageOf } from "@pupitre/utils";
import { Menu, MenuContextTrigger } from "@ui-sdk/solid/menu";
import { Folder } from "lucide-solid";
import { type Component, createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { isInsideFolder, relativeToFolder } from "@shared/paths";
import { MenuEntries, MenuPanel } from "@/components/menu-popup";
import { reportFailure } from "@/lib/errors";
import { parentFolder } from "@/lib/file";
import { FolderChildren, FolderRow, type RowMenu, type TreeContext } from "./folder-tree-rows";

interface FolderTreeProps {
  root: string;
  activePath: string | undefined;
  /** Resolves to the failure message when the file can't be opened as text. */
  onOpenFile: (path: string) => Promise<string | undefined>;
  /** Opens a folder as the tree's root. */
  onOpenFolder: (path: string) => void;
  /** Opens the folder that holds `root`; absent when the host cannot move up the tree. */
  onGoUp?: ((path: string) => void) | undefined;
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
  const [focusAfterRename, setFocusAfterRename] = createSignal<string>();
  const [newFile, setNewFile] = createSignal<string>();
  const [expanded, setExpanded] = createSignal<ReadonlySet<string>>(new Set());
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [hiddenFolders, setHiddenFolders] = createSignal<ReadonlySet<string>>(new Set());
  const [pins, setPinEntries] = createSignal<
    Awaited<ReturnType<typeof desktop.invoke<"folder:pins">>>
  >([]);
  const loadPins = (root: string) =>
    desktop.invoke("folder:pins", root).then(setPinEntries, () => setPinEntries([]));
  createEffect(
    () => props.root,
    (root) => {
      void loadPins(root);
    },
  );
  const refetchPins = () => loadPins(props.root);
  const pinnedPaths = createMemo(() => new Set(pins().map((entry) => entry.path)));
  const pinnedEntries = () => pins();
  const rowIsActive = (path: string) => props.activePath === path;
  const reportHidden = (path: string, hidden: boolean) => {
    setHiddenFolders((current) => withMember(current, path, hidden));
  };
  createEffect(
    () => hiddenFolders().size > 0,
    (hasHidden) => {
      props.onHiddenChange?.(hasHidden);
      return () => props.onHiddenChange?.(false);
    },
  );
  // The rename field lives in the sidebar too: folding it away under the field would drop the name
  // being typed and cancel the rename
  const heldOpen = () => menuOpen() || renaming() !== undefined;
  createEffect(heldOpen, (open) => {
    props.onHoldOpenChange?.(open);
    return () => props.onHoldOpenChange?.(false);
  });

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
    // A file just created opens once its author has named it; the row does not take the focus back
    const created = newFile() === path;
    if (created) setNewFile(undefined);
    void run(async () => {
      const next = await desktop.invoke("path:rename", path, name);
      await movePins(path, next);
      if (created) await openFile(next);
      else setFocusAfterRename(next);
      return { old: path, path: next };
    });
  };

  const cancelRename = () => {
    const path = renaming();
    setRenaming(undefined);
    if (path === undefined) return;
    if (newFile() === path) setNewFile(undefined);
    setFocusAfterRename(path);
  };

  // A new entry is named right away, so the folder it went into is opened for its row to show the field
  const create = (parent: string, kind: FolderEntry["kind"]) =>
    void run(async () => {
      const name = kind === "directory" ? t().sidebar.newFolder : t().common.untitledFileName;
      const path = await desktop.invoke("folder:create", parent, name, kind);
      setExpanded((current) => withMember(current, parent, true));
      setNewFile(kind === "file" ? path : undefined);
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

  // The parent entry sits at the top of the folder's own entries, under the pins
  const parent = () => {
    const goUp = props.onGoUp;
    if (goUp === undefined) return undefined;
    const path = parentFolder(props.root);
    return path === undefined ? undefined : { path, goUp };
  };

  const menuOf = (entry: FolderEntry): RowMenu => {
    const actions = new Map<string, () => void>();
    const item = (id: string, label: string, act: () => void): MenuEntry => {
      actions.set(id, act);
      return { type: "item", id, label };
    };
    const separator: MenuEntry = { type: "separator" };
    const renameItem = item("rename", t().sidebar.rename, () => setRenaming(entry.path));
    // The root is the open folder itself: trashing it would leave the sidebar on a dead path
    const trashItem =
      entry.path === props.root
        ? undefined
        : item("trash", t().sidebar.moveToTrash, () => trash(entry.path));
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
            ...(trashItem === undefined ? [] : [separator, trashItem]),
          ]
        : [
            renameItem,
            separator,
            ...pathItems,
            ...(pinItem === undefined ? [] : [separator, pinItem]),
            ...(trashItem === undefined ? [] : [separator, trashItem]),
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
    onRenameCancel: cancelRename,
    focusAfterRename,
    onFocusAfterRename: () => setFocusAfterRename(undefined),
    menuOf,
    onMenuOpenChange: setMenuOpen,
    onLevelHiddenChange: reportHidden,
    pinned: pinnedPaths,
    onTogglePin: togglePin,
  };

  return (
    // The empty space of the tree stands for the folder it shows, so a file can be created at its
    // root; it reaches the bottom of the sidebar, so the native menu does not take over there
    <Menu onOpenChange={setMenuOpen}>
      <MenuContextTrigger class="min-h-full space-y-0.5 p-2">
        <Show when={pinnedEntries().length > 0}>
          <div class="space-y-0.5">
            <div class="px-2.5 pt-1 text-2xs font-medium tracking-wider text-tertiary uppercase">
              {t().sidebar.pinned}
            </div>
            <For each={pinnedEntries()}>
              {(entry) => (
                <FolderRow entry={entry} depth={0} tree={tree} previews={() => undefined} />
              )}
            </For>
          </div>
          <div class="mx-2.5 border-t-hairline border-border-subtle" />
        </Show>
        <Show when={parent()}>
          {(target) => (
            <ListItem
              data-slot="parent-folder"
              aria-label={t().sidebar.parentFolder}
              title={t().sidebar.parentFolder}
              style={rowIndent(0, 6)}
              onClick={() => target().goUp(target().path)}
              onContextMenu={(event) => event.stopPropagation()}
            >
              <span class="size-3 shrink-0" />
              <Folder class="size-3.5 shrink-0" />
              <span class="block truncate">..</span>
            </ListItem>
          )}
        </Show>
        <FolderChildren path={props.root} depth={0} tree={tree} />
      </MenuContextTrigger>
      <MenuPanel>
        {(() => {
          const menu = menuOf({ name: props.root, path: props.root, kind: "directory" });
          return (
            <MenuEntries
              entries={menu.entries}
              onSelect={(item) => menu.actions.get(item.id)?.()}
            />
          );
        })()}
      </MenuPanel>
    </Menu>
  );
};
