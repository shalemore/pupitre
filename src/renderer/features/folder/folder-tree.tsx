import type { FolderEntry } from "@shared/desktop-api";
import { cn } from "cn";
import { ChevronRight, CircleAlert, FileText, Folder } from "lucide-solid";
import { createResource, createSignal, For, Show, type Component } from "solid-js";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";

interface TreeContext {
  activePath: () => string | undefined;
  /** Why opening a file failed, by path. */
  failures: () => Readonly<Record<string, string>>;
  onOpenFile: (path: string) => void;
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
}

const FolderChildren: Component<FolderChildrenProps> = (props) => {
  const [entries] = createResource(
    () => props.path,
    (path) => desktop.invoke("folder:list", path),
  );

  return (
    <Show
      when={!entries.error}
      fallback={
        <p class="px-2.5 py-1.5 text-[11px] text-destructive">{t().sidebar.folderUnreadable}</p>
      }
    >
      <For each={entries()}>
        {(entry) => <FolderRow entry={entry} depth={props.depth} tree={props.tree} />}
      </For>
    </Show>
  );
};

const FolderRow: Component<{ entry: FolderEntry; depth: number; tree: TreeContext }> = (props) => {
  const [expanded, setExpanded] = createSignal(false);
  const failure = () => props.tree.failures()[props.entry.path];
  const isActive = () => props.tree.activePath() === props.entry.path;

  return (
    <>
      <button
        type="button"
        dir="auto"
        onClick={() =>
          props.entry.kind === "directory"
            ? setExpanded(!expanded())
            : props.tree.onOpenFile(props.entry.path)
        }
        // The indent follows the nesting depth, which is data, so an inline style is the only option
        style={{ "padding-inline-start": `${6 + props.depth * 12}px` }}
        class={cn(
          "w-full flex items-center gap-1.5 rounded-md py-1.5 pe-2.5 text-start transition-colors cursor-pointer",
          isActive()
            ? "bg-brand/10 text-brand font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-accent",
          failure() && "text-destructive hover:text-destructive",
        )}
        title={failure() ?? props.entry.name}
      >
        <Show when={props.entry.kind === "directory"} fallback={<span class="size-3 shrink-0" />}>
          <ChevronRight
            class={cn(
              "size-3 shrink-0 transition-transform rtl:-scale-x-100",
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
        <span class="truncate">{props.entry.name}</span>
      </button>
      <Show when={expanded()}>
        <FolderChildren path={props.entry.path} depth={props.depth + 1} tree={props.tree} />
      </Show>
    </>
  );
};

export const FolderTree: Component<FolderTreeProps> = (props) => {
  const [failures, setFailures] = createSignal<Readonly<Record<string, string>>>({});

  const openFile = async (path: string) => {
    const message = await props.onOpenFile(path);
    setFailures((current) => {
      const { [path]: _previous, ...rest } = current;
      return message === undefined ? rest : { ...rest, [path]: message };
    });
  };

  return (
    <div class="p-2 space-y-0.5">
      <FolderChildren
        path={props.root}
        depth={0}
        tree={{
          activePath: () => props.activePath,
          failures,
          onOpenFile: (path) => void openFile(path),
        }}
      />
    </div>
  );
};
