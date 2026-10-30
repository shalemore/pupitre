import { ContextMenu } from "@kobalte/core/context-menu";
import { ArrowRight, ChevronRight, CircleAlert, FileText, Folder } from "lucide-solid";
import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createRoot,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import type { FolderEntry } from "@shared/desktop-api";
import type { MenuEntry } from "@shared/menu";
import { IconButton, ListItem, rowIndent } from "@/components/ui";
import { MenuEntries } from "@/features/menu/menu-popup";
import { currentLocale, t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { excerptOf } from "@/lib/markdown/excerpt";
import { settings } from "@/lib/settings";
import { FLOATING_PANEL, menuPanel } from "@/lib/styles";
import { cx } from "@/styled-system/css";
import {
  arrow,
  blockTruncate,
  chevron,
  chevronOpen,
  errorText,
  excerptLine,
  expandAnimation,
  fileIcon,
  groupRow,
  iconOffset,
  indentIcon,
  itemsStart,
  nameGrow,
  nameMin,
  openButton,
  renameField,
  renameRow,
  rowDirectory,
  secondaryLine,
} from "./folder-tree-styles";

export interface RowMenu {
  entries: readonly MenuEntry[];
  actions: ReadonlyMap<string, () => void>;
}

/** The date and time under a file row, written the way the interface language writes them. */
const dateFormat = createRoot(() =>
  createMemo(
    () => new Intl.DateTimeFormat(currentLocale(), { dateStyle: "medium", timeStyle: "short" }),
  ),
);

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
    <Show when={!entries.error} fallback={<p class={errorText}>{t().sidebar.folderUnreadable}</p>}>
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
    <div class={renameRow} style={rowIndent(props.depth, 6)}>
      <Show when={props.directory} fallback={<span class={indentIcon} />}>
        <ChevronRight class={cx(chevron, props.expanded && chevronOpen)} />
      </Show>
      <Show when={props.directory} fallback={<FileText class={fileIcon} />}>
        <Folder class={fileIcon} />
      </Show>
      <input
        type="text"
        value={props.initial}
        dir="auto"
        aria-label={t().sidebar.rename}
        class={renameField}
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
      <div class={cx("group", groupRow)}>
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
                class={cx((excerpt() || date()) && itemsStart, isDirectory() && rowDirectory)}
              >
                <Show when={isDirectory()} fallback={<span class={indentIcon} />}>
                  <ChevronRight class={cx(chevron, expanded() && chevronOpen)} />
                </Show>
                <Show
                  when={isDirectory()}
                  fallback={
                    <Show
                      when={failure()}
                      fallback={
                        <FileText class={cx(fileIcon, (excerpt() || date()) && iconOffset)} />
                      }
                    >
                      <CircleAlert class={cx(fileIcon, (excerpt() || date()) && iconOffset)} />
                    </Show>
                  }
                >
                  <Folder class={fileIcon} />
                </Show>
                <span class={cx(nameMin, excerpt() || date() ? nameGrow : blockTruncate)}>
                  <span class={blockTruncate}>
                    <bdi dir="ltr">{props.entry.name}</bdi>
                  </span>
                  <Show when={date()}>
                    {(label) => <span class={secondaryLine}>{label()}</span>}
                  </Show>
                  <Show when={excerpt()}>
                    {/* Isolated, so an excerpt in another script never turns the row around */}
                    <bdi dir="auto" aria-hidden="true" class={excerptLine}>
                      {excerpt()}
                    </bdi>
                  </Show>
                </span>
              </ContextMenu.Trigger>
              <ContextMenu.Portal>
                <ContextMenu.Content class={cx(FLOATING_PANEL, menuPanel)}>
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
            class={openButton}
            onClick={(event) => {
              event.stopPropagation();
              props.tree.onOpenFolder(props.entry.path);
            }}
          >
            <ArrowRight class={arrow} />
          </IconButton>
        </Show>
      </div>
      <Show when={expanded()}>
        <div class={expandAnimation}>
          <FolderChildren path={props.entry.path} depth={props.depth + 1} tree={props.tree} />
        </div>
      </Show>
    </>
  );
};
