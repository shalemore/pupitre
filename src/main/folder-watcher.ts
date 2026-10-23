import { watch, type FSWatcher } from "node:fs";
import type { WebContents } from "electron";

/** Editors and sync tools write in bursts; one notification per burst is enough. */
const DEBOUNCE_MS = 150;

interface Watch {
  watcher: FSWatcher;
  timer: NodeJS.Timeout | undefined;
}

const watchesBySender = new Map<WebContents, Map<string, Watch>>();

function close(entry: Watch): void {
  clearTimeout(entry.timer);
  entry.watcher.close();
}

/**
 * Watches one folder, without its subfolders, and tells the window when its entries change. A
 * recursive watch would be expensive on large trees, and the sidebar only shows folders the user
 * has expanded.
 */
export function watchFolder(sender: WebContents, path: string): void {
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
  if (watches.has(path)) return;

  try {
    const entry: Watch = { watcher: watch(path), timer: undefined };
    entry.watcher.on("change", () => {
      clearTimeout(entry.timer);
      entry.timer = setTimeout(() => {
        if (!sender.isDestroyed()) sender.send("folder:changed", path);
      }, DEBOUNCE_MS);
    });
    // The folder was removed or became unreadable; the tree reports it the next time it lists the folder
    entry.watcher.on("error", () => unwatchFolder(sender, path));
    watches.set(path, entry);
  } catch {
    // Listing the folder reports the same problem to the user
  }
}

export function unwatchFolder(sender: WebContents, path: string): void {
  const entry = watchesBySender.get(sender)?.get(path);
  if (!entry) return;
  close(entry);
  watchesBySender.get(sender)?.delete(path);
}
