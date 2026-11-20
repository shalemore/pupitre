import { watch, type FSWatcher } from "chokidar";
import type { WebContents } from "electron";
import { createDebouncedTask, type DebouncedTask } from "../debounced-task";

/** Editors and sync tools write in bursts; one notification per burst is enough. */
const DEBOUNCE_MS = 150;

type WatchEvent = "folder:changed" | "document:changed";

interface Watch {
  watcher: FSWatcher;
  task: DebouncedTask;
}

const watchesBySender = new Map<WebContents, Map<string, Watch>>();

function close(entry: Watch): void {
  entry.task.cancel();
  void entry.watcher.close();
}

function keyOf(event: WatchEvent, path: string): string {
  return `${event}:${path}`;
}

/**
 * Tells the window, through `event`, when `path` changes. A folder is watched without its
 * subfolders: a recursive watch would be expensive on large trees, and the sidebar only shows
 * folders the user has expanded. A file is watched as itself, and a save that replaces it with a
 * temporary file and a rename still counts as one change.
 */
export function watchPath(sender: WebContents, event: WatchEvent, path: string): void {
  let watches = watchesBySender.get(sender);
  if (!watches) {
    const created = new Map<string, Watch>();
    watches = created;
    watchesBySender.set(sender, created);
    sender.once("destroyed", () => {
      created.forEach(close);
      watchesBySender.delete(sender);
    });
  }
  const key = keyOf(event, path);
  if (watches.has(key)) return;

  try {
    const entry: Watch = {
      watcher: watch(path, {
        ignoreInitial: true,
        atomic: true,
        ...(event === "folder:changed" ? { depth: 0 } : {}),
      }),
      task: createDebouncedTask(() => {
        if (!sender.isDestroyed()) sender.send(event, path);
      }, DEBOUNCE_MS),
    };
    const changed = () => entry.task.schedule();
    entry.watcher
      .on("add", changed)
      .on("change", changed)
      .on("unlink", changed)
      .on("addDir", changed)
      .on("unlinkDir", changed)
      .on("error", () => unwatchPath(sender, event, path));
    watches.set(key, entry);
  } catch {
    // Reading the path reports the same problem to the user
  }
}

export function unwatchPath(sender: WebContents, event: WatchEvent, path: string): void {
  const watches = watchesBySender.get(sender);
  const key = keyOf(event, path);
  const entry = watches?.get(key);
  if (!entry) return;
  close(entry);
  watches?.delete(key);
}
