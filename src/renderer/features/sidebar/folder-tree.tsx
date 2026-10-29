import { ContextMenu } from "@kobalte/core/context-menu";
import { cn } from "cn";
import { ArrowRight, ChevronRight, CircleAlert, FileText, Folder } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createResource,
  createRoot,
  createSelector,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
  type Component,
} from "solid-js";
import type { FolderEntry } from "@shared/desktop-api";
import { messageOf } from "@shared/errors";
import type { MenuEntry } from "@shared/menu";
import { isInsideFolder, relativeToFolder } from "@shared/paths";
import { IconButton, ListItem, rowIndent } from "@/components/ui";
import { MenuEntries } from "@/features/menu/menu-popup";
import { currentLocale, t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { reportFailure } from "@/lib/errors";
import { excerptOf } from "@/lib/markdown-excerpt";
import { settings } from "@/lib/settings";

/** The menu of a row: what it lists, and what each entry runs, by id. */
interface RowMenu {
  entries: readonly MenuEntry[];
  actions: ReadonlyMap<string, () => void>;
}

/** The date and time under a file row, written the way the interface language writes them. */
const dateFormat = createRoot(() =>
  createMemo(
    () => new Intl.DateTimeFormat(currentLocale(), { dateStyle: "medium", timeStyle: "short" }),
  ),
);

/** A copy of `set` with `item` present or absent; the same set when it already is that way. */
function withMember<T>(set: ReadonlySet<T>, item: T, present: boolean): ReadonlySet<T> {
  if (set.has(item) === present) return set;
  const next = new Set(set);
  if (present) next.add(item);
  else next.delete(item);
  return next;
}

interface TreeContext {
  /** Whether the row at `path` is the document shown in the editor. */
  isActive: (path: string) => boolean;
  /** Why opening a file failed, by path. */
  failures: () => Readonly<Record<string, string>>;
  onOpenFile: (path: string) => void;
  /** Whether a folder row shows its children. */
  isExpanded: (path: string) => boolean;
  onToggleExpanded: (path: string) => void;
  /** Opens a folder as the tree's root. */
  onOpenFolder: (path: string) => void;
  /** The row whose name is being edited, if any. */
  renaming: () => string | undefined;
  onRename: (path: string, name: string) => void;
  onRenameCancel: () => void;
  /** The menu of a row, built when it opens. */
  menuOf: (entry: FolderEntry) => RowMenu;
  /** Told when a row menu opens or closes. */
  onMenuOpenChange: (open: boolean) => void;
  /** Told when a level shows or stops showing hidden entries. */
  onLevelHiddenChange: (path: string, hidden: boolean) => void;
  /** The absolute paths pinned at the top of this tree. */
  pinned: () => ReadonlySet<string>;
  onTogglePin: (entry: FolderEntry) => void;
}

interface FolderChildrenProps {
  path: string;
  depth: number;
  tree: TreeContext;
}

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

const FolderChildren: Component<FolderChildrenProps> = (props) => {
  const [entries, { refetch }] = createResource(
    () => props.path,
    (path) => desktop.invoke("folder:list", path),
  );
  // Only read while previews are on, so a folder costs nothing when its rows show names alone
  const [previews, { refetch: refetchPreviews }] = createResource(
    () => (settings().sidebarPreview ? props.path : undefined),
    (path) => desktop.invoke("folder:previews", path),
  );
  // The resource keeps its last value when previews go off, so the rows stop reading it instead
  const shownPreviews = () => (settings().sidebarPreview ? previews() : undefined);

  onMount(() => {
    const { path } = props;
    void desktop.invoke("folder:watch", path);
    const unlisten = desktop.on("folder:changed", (changed) => {
      if (changed !== path) return;
      void refetch();
      void refetchPreviews();
    });
    onCleanup(() => {
      unlisten();
      void desktop.invoke("folder:unwatch", path);
    });
  });

  // The main process orders the rows, so a new order has to be asked for; the rows stay on screen
  // until it arrives, and every other open folder asks for its own again the same way. The memo
  // keeps the settings broadcast, which replaces the whole object, from asking for the same order.
  const folderSort = createMemo(() => settings().folderSort);
  createEffect(on(folderSort, () => void refetch(), { defer: true }));
  const showHidden = createMemo(() => settings().showHidden);

  // Each level a person has opened reports for itself; the tree never walks a folder just to find
  // out whether an eye is needed. The flag is there even while hidden entries are shown, so the
  // eye can turn them off again.
  createEffect(() => {
    props.tree.onLevelHiddenChange(
      props.path,
      (entries() ?? []).some(
        (entry) => entry.hidden === true && !props.tree.pinned().has(entry.path),
      ),
    );
  });
  onCleanup(() => props.tree.onLevelHiddenChange(props.path, false));

  const shownEntries = createMemo(() =>
    (entries() ?? []).filter(
      (entry) => (showHidden() || entry.hidden !== true) && !props.tree.pinned().has(entry.path),
    ),
  );

  return (
    <Show
      when={!entries.error}
      fallback={
        <p class="px-2.5 py-1.5 text-2xs text-destructive">{t().sidebar.folderUnreadable}</p>
      }
    >
      <For each={shownEntries()}>
        {(entry) => (
          <FolderRow entry={entry} depth={props.depth} tree={props.tree} previews={shownPreviews} />
        )}
      </For>
    </Show>
  );
};

/** The name of a row being renamed, edited in place; Enter keeps the name, Escape or leaving the field drops it. */
const RenameField: Component<{
  initial: string;
  depth: number;
  directory: boolean;
  expanded: boolean;
  onCommit: (name: string) => void;
  onCancel: () => void;
}> = (props) => {
  // A folder that refreshes while the field is open replaces its rows, and the field that goes away
  // must not count as the user leaving it
  let replaced = false;
  onCleanup(() => (replaced = true));

  return (
    // The field keeps the row's chevron and icon, so its box starts where the names of the other
    // rows do, and the indent stays outside the box rather than spanning the whole sidebar
    <div class="flex items-center gap-1.5 pe-2.5" style={rowIndent(props.depth, 6)}>
      <Show when={props.directory} fallback={<span class="size-3 shrink-0" />}>
        <ChevronRight
          class={cn(
            "size-3 shrink-0 transition-transform duration-base rtl:-scale-x-100",
            props.expanded && "rotate-90 rtl:rotate-90",
          )}
        />
      </Show>
      <Show when={props.directory} fallback={<FileText class="size-3.5 shrink-0" />}>
        <Folder class="size-3.5 shrink-0" />
      </Show>
      <input
        type="text"
        value={props.initial}
        dir="auto"
        aria-label={t().sidebar.rename}
        class="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs text-foreground outline-none focus-visible:shadow-focus"
        // Focused once it is in the document, so typing replaces the selected name right away
        ref={(element) =>
          requestAnimationFrame(() => {
            element.focus();
            element.select();
          })
        }
        onKeyDown={(event) => {
          if (event.key === "Enter") props.onCommit(event.currentTarget.value);
          else if (event.key === "Escape") props.onCancel();
        }}
        onBlur={() => {
          if (!replaced) props.onCancel();
        }}
      />
    </div>
  );
};

const FolderRow: Component<{
  entry: FolderEntry;
  depth: number;
  tree: TreeContext;
  /** The beginning of each file in this folder, when previews are on. */
  previews: () => Readonly<Record<string, string>> | undefined;
}> = (props) => {
  const expanded = () => props.tree.isExpanded(props.entry.path);
  const failure = () => props.tree.failures()[props.entry.path];
  const isActive = () => props.tree.isActive(props.entry.path);
  const isDirectory = () => props.entry.kind === "directory";
  const excerpt = createMemo(
    () => excerptOf(props.previews()?.[props.entry.path] ?? "") || undefined,
  );
  // The folder order that reads a time also shows it under the file, so the order has a reason on screen
  const date = createMemo(() => {
    const time = props.entry.time;
    if (time === undefined || isDirectory() || settings().folderSort === "name") return undefined;
    return dateFormat().format(time);
  });

  return (
    <>
      <div class="group relative">
        <Show
          when={props.tree.renaming() === props.entry.path}
          fallback={
            <ContextMenu onOpenChange={props.tree.onMenuOpenChange}>
              <ContextMenu.Trigger
                as={ListItem}
                dir="auto"
                active={isActive()}
                tone={failure() ? "danger" : "default"}
                onClick={() =>
                  isDirectory()
                    ? props.tree.onToggleExpanded(props.entry.path)
                    : props.tree.onOpenFile(props.entry.path)
                }
                // A row's menu is its own; the empty space behind it has the folder's
                onContextMenu={(event) => event.stopPropagation()}
                style={rowIndent(props.depth, 6)}
                title={failure() ?? props.entry.name}
                class={cn((excerpt() || date()) && "items-start", isDirectory() && "pe-8")}
              >
                <Show when={isDirectory()} fallback={<span class="size-3 shrink-0" />}>
                  <ChevronRight
                    class={cn(
                      "size-3 shrink-0 transition-transform duration-base rtl:-scale-x-100",
                      expanded() && "rotate-90 rtl:rotate-90",
                    )}
                  />
                </Show>
                <Show
                  when={isDirectory()}
                  fallback={
                    <Show
                      when={failure()}
                      fallback={
                        <FileText
                          class={cn("size-3.5 shrink-0", (excerpt() || date()) && "mt-0.5")}
                        />
                      }
                    >
                      <CircleAlert
                        class={cn("size-3.5 shrink-0", (excerpt() || date()) && "mt-0.5")}
                      />
                    </Show>
                  }
                >
                  <Folder class="size-3.5 shrink-0" />
                </Show>
                <span class={cn("min-w-0", excerpt() || date() ? "flex-1" : "truncate")}>
                  <span class="block truncate">
                    <bdi dir="ltr">{props.entry.name}</bdi>
                  </span>
                  <Show when={date()}>
                    {(label) => (
                      <span class="block text-2xs font-normal text-tertiary tabular-nums">
                        {label()}
                      </span>
                    )}
                  </Show>
                  <Show when={excerpt()}>
                    {/* Isolated, so an excerpt in another script never turns the row around */}
                    <bdi
                      dir="auto"
                      aria-hidden="true"
                      class="mt-0.5 line-clamp-2 text-2xs font-normal text-tertiary"
                    >
                      {excerpt()}
                    </bdi>
                  </Show>
                </span>
              </ContextMenu.Trigger>
              <ContextMenu.Portal>
                <ContextMenu.Content class="floating-panel z-50 flex min-w-52 max-h-(--kb-popper-content-available-height) flex-col overflow-y-auto overscroll-contain p-1 text-xs text-foreground outline-none select-none">
                  {(() => {
                    const menu = props.tree.menuOf(props.entry);
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
          }
        >
          <RenameField
            initial={props.entry.name}
            depth={props.depth}
            directory={isDirectory()}
            expanded={expanded()}
            onCommit={(name) => props.tree.onRename(props.entry.path, name)}
            onCancel={() => props.tree.onRenameCancel()}
          />
        </Show>
        <Show when={isDirectory() && props.tree.renaming() !== props.entry.path}>
          {/* A folder can be opened as the tree's root without leaving the pointer's row */}
          <IconButton
            label={t().menu.openFolder}
            size="icon-2xs"
            data-slot="folder-open"
            class="absolute inset-e-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            onClick={(event) => {
              event.stopPropagation();
              props.tree.onOpenFolder(props.entry.path);
            }}
          >
            <ArrowRight class="size-3 rtl:-scale-x-100" />
          </IconButton>
        </Show>
      </div>
      <Show when={expanded()}>
        <div class="space-y-0.5 animate-in fade-in-0 slide-in-from-top-1 duration-base ease-enter">
          <FolderChildren path={props.entry.path} depth={props.depth + 1} tree={props.tree} />
        </div>
      </Show>
    </>
  );
};

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
      <ContextMenu.Trigger as="div" class="p-2 space-y-0.5 min-h-full">
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
          <div class="mx-2.5 border-t border-border-subtle" />
        </Show>
        <FolderChildren path={props.root} depth={0} tree={tree} />
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content class="floating-panel z-50 flex min-w-52 max-h-(--kb-popper-content-available-height) flex-col overflow-y-auto overscroll-contain p-1 text-xs text-foreground outline-none select-none">
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
