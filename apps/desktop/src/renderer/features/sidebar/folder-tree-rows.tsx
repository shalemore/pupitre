import type { FolderEntry } from "@pupitre/desktop-api";
import { desktop } from "@pupitre/desktop-api/client";
import type { MenuEntry } from "@pupitre/desktop-api/menu";
import { t } from "@pupitre/i18n/solid";
import { excerptOf } from "@pupitre/markdown";
import { cn, IconButton, Input, ListItem, rowIndent } from "@pupitre/ui";
import { Menu, MenuContextTrigger } from "@ui-sdk/solid/menu";
import { ArrowRight, ChevronRight, CircleAlert, FileText, Folder } from "lucide-solid";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onSettled,
  Show,
} from "solid-js";
import { MenuEntries, MenuPanel } from "@/components/menu-popup";
import { dateTimeFormat } from "@/lib/date-format";
import { settings } from "@/lib/settings";

const TreeChevron: Component<{ expanded: boolean }> = (props) => (
  <ChevronRight
    class={cn(
      "size-3 shrink-0 transition-transform duration-base ease-out-expo rtl:-scale-x-100",
      props.expanded && "rotate-90 rtl:-rotate-90",
    )}
  />
);

export interface RowMenu {
  entries: readonly MenuEntry[];
  actions: ReadonlyMap<string, () => void>;
}

export interface TreeContext {
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
  /** The row a rename left to focus once it is on the page again. */
  focusAfterRename: () => string | undefined;
  onFocusAfterRename: () => void;
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

export const FolderChildren: Component<FolderChildrenProps> = (props) => {
  const [entries, setEntries] = createSignal<readonly FolderEntry[]>([]);
  const [entriesError, setEntriesError] = createSignal(false);
  const [previews, setPreviews] = createSignal<Readonly<Record<string, string>>>();
  const folderSort = createMemo(() => settings().folderSort);

  const loadEntries = (path: string) => {
    void desktop.invoke("folder:list", path).then(
      (list) => {
        setEntriesError(false);
        setEntries(list);
      },
      () => {
        setEntriesError(true);
      },
    );
  };
  const loadPreviews = (path: string) => {
    void desktop.invoke("folder:previews", path).then(setPreviews, () => undefined);
  };

  createEffect(
    () => [props.path, folderSort()] as const,
    ([path]) => loadEntries(path),
  );
  // Only read while previews are on, so a folder costs nothing when its rows show names alone
  createEffect(
    () => (settings().sidebarPreview ? props.path : undefined),
    (path) => {
      if (path !== undefined) loadPreviews(path);
    },
  );
  // The previews keep their last value when previews go off, so the rows stop reading it instead
  const shownPreviews = () => (settings().sidebarPreview ? previews() : undefined);

  onSettled(() => {
    const { path } = props;
    void desktop.invoke("folder:watch", path);
    const unlisten = desktop.on("folder:changed", (changed) => {
      if (changed !== path) return;
      loadEntries(path);
      if (settings().sidebarPreview) loadPreviews(path);
    });
    return () => {
      unlisten();
      void desktop.invoke("folder:unwatch", path);
    };
  });

  const showHidden = createMemo(() => settings().showHidden);

  // Each level a person has opened reports for itself; the tree never walks a folder just to find
  // out whether an eye is needed. The flag is there even while hidden entries are shown, so the
  // eye can turn them off again.
  createEffect(
    () => entries().some((entry) => entry.hidden === true && !props.tree.pinned().has(entry.path)),
    (hasHidden) => {
      props.tree.onLevelHiddenChange(props.path, hasHidden);
      return () => props.tree.onLevelHiddenChange(props.path, false);
    },
  );

  const shownEntries = createMemo(() =>
    entries().filter(
      (entry) => (showHidden() || entry.hidden !== true) && !props.tree.pinned().has(entry.path),
    ),
  );

  return (
    <Show
      when={!entriesError()}
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
        <TreeChevron expanded={props.expanded} />
      </Show>
      <Show when={props.directory} fallback={<FileText class="size-3.5 shrink-0" />}>
        <Folder class="size-3.5 shrink-0" />
      </Show>
      <Input
        type="text"
        value={props.initial}
        dir="auto"
        aria-label={t().sidebar.rename}
        class="min-w-0 flex-1 py-1 ps-0 pe-2.5 text-xs"
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

export const FolderRow: Component<{
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
  // A rename takes the focused field away; the row that replaces it takes focus once it is here
  createEffect(
    () => props.tree.focusAfterRename() === props.entry.path,
    (shouldFocus) => {
      if (!shouldFocus) return;
      requestAnimationFrame(() => {
        const row = [...document.querySelectorAll<HTMLButtonElement>("[data-folder-row]")].find(
          (element) => element.dataset["folderRow"] === props.entry.path,
        );
        if (row === undefined) return;
        props.tree.onFocusAfterRename();
        row.focus();
      });
    },
  );
  const excerpt = createMemo(
    () => excerptOf(props.previews()?.[props.entry.path] ?? "") || undefined,
  );
  // The folder order that reads a time also shows it under the file, so the order has a reason on screen
  const date = createMemo(() => {
    const time = props.entry.time;
    if (time === undefined || isDirectory() || settings().folderSort === "name") return undefined;
    return dateTimeFormat().format(time);
  });

  return (
    <>
      <div class="group relative">
        <Show
          when={props.tree.renaming() === props.entry.path}
          fallback={
            <Menu onOpenChange={props.tree.onMenuOpenChange}>
              <MenuContextTrigger
                render={(triggerProps) => (
                  <ListItem
                    {...triggerProps}
                    data-folder-row={props.entry.path}
                    active={isActive()}
                    tone={failure() ? "danger" : "default"}
                    onClick={() =>
                      isDirectory()
                        ? props.tree.onToggleExpanded(props.entry.path)
                        : props.tree.onOpenFile(props.entry.path)
                    }
                    // A row's menu is its own; the empty space behind it has the folder's
                    onContextMenu={(event) => {
                      event.stopPropagation();
                      const handler = triggerProps["onContextMenu"];
                      if (typeof handler === "function") handler(event);
                    }}
                    style={rowIndent(props.depth, 6)}
                    title={failure() ?? props.entry.name}
                    class={cn((excerpt() || date()) && "items-start", isDirectory() && "pe-8")}
                  >
                    <Show when={isDirectory()} fallback={<span class="size-3 shrink-0" />}>
                      <TreeChevron expanded={expanded()} />
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
                    <span class={cn("min-w-0", excerpt() || date() ? "flex-1" : "block truncate")}>
                      <span class="block truncate">
                        <bdi dir="auto">{props.entry.name}</bdi>
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
                  </ListItem>
                )}
              />
              <MenuPanel>
                {(() => {
                  const menu = props.tree.menuOf(props.entry);
                  return (
                    <MenuEntries
                      entries={menu.entries}
                      onSelect={(item) => menu.actions.get(item.id)?.()}
                    />
                  );
                })()}
              </MenuPanel>
            </Menu>
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
            class="absolute inset-e-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-ui ease-out-expo group-hover:opacity-100 focus-visible:opacity-100"
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
        <div class="animate-fade-in-down-small space-y-0.5">
          <FolderChildren path={props.entry.path} depth={props.depth + 1} tree={props.tree} />
        </div>
      </Show>
    </>
  );
};
