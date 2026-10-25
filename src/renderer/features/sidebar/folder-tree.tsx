import { cn } from "cn";
import { ChevronRight, CircleAlert, FileText, Folder } from "lucide-solid";
import {
  createResource,
  createSignal,
  For,
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
import { messageOf } from "@/lib/errors";

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
}

const FolderChildren: Component<FolderChildrenProps> = (props) => {
  const [entries, { refetch }] = createResource(
    () => props.path,
    (path) => desktop.invoke("folder:list", path),
  );

  onMount(() => {
    const { path } = props;
    void desktop.invoke("folder:watch", path);
    const unlisten = desktop.on("folder:changed", (changed) => {
      if (changed === path) void refetch();
    });
    onCleanup(() => {
      unlisten();
      void desktop.invoke("folder:unwatch", path);
    });
  });

  return (
    <Show
      when={!entries.error}
      fallback={
        <p class="px-2.5 py-1.5 text-2xs text-destructive">{t().sidebar.folderUnreadable}</p>
      }
    >
      <For each={entries()}>
        {(entry) => <FolderRow entry={entry} depth={props.depth} tree={props.tree} />}
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

const FolderRow: Component<{ entry: FolderEntry; depth: number; tree: TreeContext }> = (props) => {
  const expanded = () => props.tree.isExpanded(props.entry.path);
  const failure = () => props.tree.failures()[props.entry.path];
  const isActive = () => props.tree.activePath() === props.entry.path;

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
              props.entry.kind === "directory"
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
          >
            <Show
              when={props.entry.kind === "directory"}
              fallback={<span class="size-3 shrink-0" />}
            >
              <ChevronRight
                class={cn(
                  "size-3 shrink-0 transition-transform duration-base rtl:-scale-x-100",
                  expanded() && "rotate-90 rtl:rotate-90",
                )}
              />
            </Show>
            <Show
              when={props.entry.kind === "directory"}
              fallback={
                <Show when={failure()} fallback={<FileText class="size-3.5 shrink-0" />}>
                  <CircleAlert class="size-3.5 shrink-0" />
                </Show>
              }
            >
              <Folder class="size-3.5 shrink-0" />
            </Show>
            <span class="min-w-0 truncate">
              <bdi dir="ltr">{props.entry.name}</bdi>
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
      await desktop.invoke("dialog:show-error", t().dialogs.fileActionFailed, message);
    }
  };

  const rename = (path: string, name: string) => {
    setRenaming(undefined);
    void run(async () => ({ old: path, path: await desktop.invoke("path:rename", path, name) }));
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

  const trash = (path: string) =>
    void run(async () => {
      await desktop.invoke("path:trash", path);
      return undefined;
    });

  const openMenu = (entry: FolderEntry, event: MouseEvent) => {
    const actions = new Map<string, () => void>();
    const item = (id: string, label: string, act: () => void): MenuEntry => {
      actions.set(id, act);
      return { type: "item", id, label };
    };
    const renameItem = item("rename", t().sidebar.rename, () => setRenaming(entry.path));
    const trashItem = item("trash", t().sidebar.moveToTrash, () => trash(entry.path));
    const entries: MenuEntry[] =
      entry.kind === "directory"
        ? [
            item("new-file", t().menu.newFile, () => create(entry.path, "file")),
            item("new-folder", t().sidebar.newFolder, () => create(entry.path, "directory")),
            { type: "separator" },
            renameItem,
            trashItem,
          ]
        : [renameItem, trashItem];
    setMenu({ entries, actions, anchor: new DOMRect(event.clientX, event.clientY, 0, 0) });
  };

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
  };

  return (
    // The empty space of the tree stands for the folder it shows, so a file can be created at its root
    <div
      class="p-2 space-y-0.5"
      onContextMenu={(event) => {
        event.preventDefault();
        openMenu({ name: props.root, path: props.root, kind: "directory" }, event);
      }}
    >
      <FolderChildren path={props.root} depth={0} tree={tree} />
      <Show when={menu()} keyed>
        {(open) => (
          <MenuPopup
            entries={open.entries}
            anchor={open.anchor}
            onSelect={(entry) => {
              const action = open.actions.get(entry.id);
              setMenu(undefined);
              action?.();
            }}
            onClose={() => setMenu(undefined)}
          />
        )}
      </Show>
    </div>
  );
};
