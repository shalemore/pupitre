import { cn } from "cn";
import { ChevronRight, CircleAlert, FileText, Folder } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
  type Component,
} from "solid-js";
import type { FolderEntry } from "@shared/desktop-api";
import type { MenuEntry } from "@shared/menu";
import { ListItem, rowIndent } from "@/components/ui";
import { MenuPopup } from "@/features/menu/menu-popup";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { messageOf, reportFailure } from "@/lib/errors";
import { isInsideFolder, relativeToFolder } from "@/lib/file";
import { excerptOf } from "@/lib/markdown-excerpt";
import { settings } from "@/lib/settings";

interface TreeContext {
  activePath: () => string | undefined;
  /** Why opening a file failed, by path. */
  failures: () => Readonly<Record<string, string>>;
  onOpenFile: (path: string) => void;
  /** Whether a folder row shows its children. */
  isExpanded: (path: string) => boolean;
  onToggleExpanded: (path: string) => void;
  /** The row whose name is being edited, if any. */
  renaming: () => string | undefined;
  onRename: (path: string, name: string) => void;
  onRenameCancel: () => void;
  /** Opens the menu of a row at the pointer. */
  onMenu: (entry: FolderEntry, event: MouseEvent) => void;
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
  /** Tells the window that a document or a folder root moved, so the open document follows it. */
  onPathChanged?: (oldPath: string, newPath: string) => void;
  /** Tells the window that a menu or the rename field holds the sidebar, so the immersive chrome stays put. */
  onHoldOpenChange?: (open: boolean) => void;
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
  // until it arrives, and every other open folder asks for its own again the same way
  createEffect(
    on(
      () => settings().folderSort,
      () => void refetch(),
      { defer: true },
    ),
  );

  return (
    <Show
      when={!entries.error}
      fallback={
        <p class="px-2.5 py-1.5 text-2xs text-destructive">{t().sidebar.folderUnreadable}</p>
      }
    >
      <For each={(entries() ?? []).filter((entry) => !props.tree.pinned().has(entry.path))}>
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
  onCommit: (name: string) => void;
  onCancel: () => void;
}> = (props) => {
  // A folder that refreshes while the field is open replaces its rows, and the field that goes away
  // must not count as the user leaving it
  let replaced = false;
  onCleanup(() => (replaced = true));

  return (
    <input
      type="text"
      value={props.initial}
      dir="auto"
      aria-label={t().sidebar.rename}
      style={rowIndent(props.depth, 6)}
      class="w-full rounded-md border border-border bg-surface-2 py-1 pe-2.5 text-xs text-foreground outline-none focus-visible:shadow-focus"
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
  const isActive = () => props.tree.activePath() === props.entry.path;
  const isDirectory = () => props.entry.kind === "directory";
  const excerpt = createMemo(
    () => excerptOf(props.previews()?.[props.entry.path] ?? "") || undefined,
  );

  return (
    <>
      <Show
        when={props.tree.renaming() === props.entry.path}
        fallback={
          <ListItem
            dir="auto"
            active={isActive()}
            tone={failure() ? "danger" : "default"}
            onClick={() =>
              isDirectory()
                ? props.tree.onToggleExpanded(props.entry.path)
                : props.tree.onOpenFile(props.entry.path)
            }
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              props.tree.onMenu(props.entry, event);
            }}
            style={rowIndent(props.depth, 6)}
            title={failure() ?? props.entry.name}
            class={cn(excerpt() && "items-start")}
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
                  fallback={<FileText class={cn("size-3.5 shrink-0", excerpt() && "mt-0.5")} />}
                >
                  <CircleAlert class={cn("size-3.5 shrink-0", excerpt() && "mt-0.5")} />
                </Show>
              }
            >
              <Folder class="size-3.5 shrink-0" />
            </Show>
            <span class={cn("min-w-0", excerpt() ? "flex-1" : "truncate")}>
              <span class="block truncate">
                <bdi dir="ltr">{props.entry.name}</bdi>
              </span>
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
          </ListItem>
        }
      >
        <RenameField
          initial={props.entry.name}
          depth={props.depth}
          onCommit={(name) => props.tree.onRename(props.entry.path, name)}
          onCancel={() => props.tree.onRenameCancel()}
        />
      </Show>
      <Show when={expanded()}>
        <div class="space-y-0.5 animate-in fade-in-0 slide-in-from-top-1 duration-base ease-enter">
          <FolderChildren path={props.entry.path} depth={props.depth + 1} tree={props.tree} />
        </div>
      </Show>
    </>
  );
};

/** One entry of the row menu, with the action it runs. */
interface OpenMenu {
  entries: readonly MenuEntry[];
  actions: ReadonlyMap<string, () => void>;
  /** Where the pointer opened the menu. */
  anchor: DOMRect;
}

interface PathChange {
  old: string;
  path: string;
}

export const FolderTree: Component<FolderTreeProps> = (props) => {
  const [failures, setFailures] = createSignal<Readonly<Record<string, string>>>({});
  const [renaming, setRenaming] = createSignal<string>();
  const [expanded, setExpanded] = createSignal<ReadonlySet<string>>(new Set());
  const [menu, setMenu] = createSignal<OpenMenu>();
  const [pins, { refetch: refetchPins }] = createResource(
    () => props.root,
    (root) => desktop.invoke("folder:pins", root),
  );
  const pinnedPaths = createMemo(() => new Set((pins() ?? []).map((entry) => entry.path)));
  const pinnedEntries = () => pins() ?? [];
  // The rename field lives in the sidebar too: folding it away under the field would drop the name
  // being typed and cancel the rename
  const heldOpen = () => menu() !== undefined || renaming() !== undefined;
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
      setExpanded((current) => new Set(current).add(parent));
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

  const openMenu = (entry: FolderEntry, event: MouseEvent) => {
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
    setMenu({ entries, actions, anchor: new DOMRect(event.clientX, event.clientY, 0, 0) });
  };

  const closeMenu = () => setMenu(undefined);

  const tree: TreeContext = {
    activePath: () => props.activePath,
    failures,
    onOpenFile: (path) => void openFile(path),
    isExpanded: (path) => expanded().has(path),
    onToggleExpanded: (path) =>
      setExpanded((current) => {
        const next = new Set(current);
        if (!next.delete(path)) next.add(path);
        return next;
      }),
    renaming,
    onRename: rename,
    onRenameCancel: () => setRenaming(undefined),
    onMenu: openMenu,
    pinned: pinnedPaths,
    onTogglePin: togglePin,
  };

  return (
    // The empty space of the tree stands for the folder it shows, so a file can be created at its
    // root; it reaches the bottom of the sidebar, so the native menu does not take over there
    <div
      class="p-2 space-y-0.5 min-h-full"
      onContextMenu={(event) => {
        event.preventDefault();
        openMenu({ name: props.root, path: props.root, kind: "directory" }, event);
      }}
    >
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
      <Show when={menu()} keyed>
        {(open) => (
          <MenuPopup
            entries={open.entries}
            anchor={open.anchor}
            onSelect={(entry) => {
              const action = open.actions.get(entry.id);
              closeMenu();
              action?.();
            }}
            onClose={closeMenu}
          />
        )}
      </Show>
    </div>
  );
};
