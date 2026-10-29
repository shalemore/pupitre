import { watch, type FSWatcher } from "node:fs";
import { basename, dirname } from "node:path";
import type { WebContents } from "electron";
import { createDebouncedTask, type DebouncedTask } from "./debounced-task";

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
  entry.watcher.close();
}

function keyOf(event: WatchEvent, path: string): string {
  return `${event}:${path}`;
}

/**
 * Tells the window, through `event`, when `path` changes. A folder is watched without its
 * subfolders: a recursive watch would be expensive on large trees, and the sidebar only shows
 * folders the user has expanded. A file is watched through its folder, because editors that save
 * by replacing the file would otherwise leave a watch on the old file behind.
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

  const watchedFile = event === "document:changed" ? basename(path) : undefined;
  try {
    const entry: Watch = {
      watcher: watch(event === "document:changed" ? dirname(path) : path),
      task: createDebouncedTask(() => {
        if (!sender.isDestroyed()) sender.send(event, path);
      }, DEBOUNCE_MS),
    };
    entry.watcher.on("change", (_type, name) => {
      // The file name is not always reported; then any change in the folder counts
      if (watchedFile !== undefined && name !== null && name.toString() !== watchedFile) return;
      entry.task.schedule();
    });
    // The folder was removed or became unreadable; the window finds out the next time it reads it
    entry.watcher.on("error", () => unwatchPath(sender, event, path));
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
