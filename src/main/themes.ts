import { existsSync, mkdirSync, readdirSync, watch, type FSWatcher } from "node:fs";
import { basename, dirname, join } from "node:path";
import { app, BrowserWindow, shell } from "electron";
import type { ImportedTheme } from "@shared/desktop-api";
import { readThemesFromRoot } from "./theme-folders";

/** A write may arrive as several events, such as a temporary file and the rename after it. */
const REFRESH_DELAY = 120;
/** How far below a theme folder the watcher follows asset folders; theme folders are shallow. */
const MAX_WATCH_DEPTH = 4;

let started = false;
let projectRoot: string | undefined;
let current: readonly ImportedTheme[] = [];
let watchers: FSWatcher[] = [];
let timer: NodeJS.Timeout | undefined;

function globalRoot(): string {
  return join(app.getPath("userData"), "themes");
}

function projectThemes(): string | undefined {
  return projectRoot === undefined ? undefined : join(projectRoot, ".pupitre", "themes");
}

function readAll(): ImportedTheme[] {
  const themes = [...readThemesFromRoot(globalRoot(), "global")];
  const project = projectThemes();
  if (project !== undefined) themes.push(...readThemesFromRoot(project, "project"));
  return themes;
}

function broadcast(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("themes:changed", current);
  }
}

function refresh(): void {
  const next = readAll();
  const changed = JSON.stringify(next) !== JSON.stringify(current);
  current = next;
  if (changed) broadcast();
  rewatch();
}

function schedule(): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    refresh();
  }, REFRESH_DELAY);
}

interface Target {
  path: string;
  child?: string;
}

/**
 * The folders to watch for `root`: the deepest existing directory that leads to it, then the root
 * and each theme folder once it exists. Watching the deepest existing ancestor is how a folder
 * that appears later is noticed.
 */
function targetsFor(root: string): Target[] {
  const missing: string[] = [];
  let existing = root;
  while (!existsSync(existing)) {
    missing.push(existing);
    const parent = dirname(existing);
    if (parent === existing) return [];
    existing = parent;
  }
  if (missing.length > 0) {
    const child = missing.at(-1);
    return child === undefined ? [] : [{ path: existing, child: basename(child) }];
  }
  const targets: Target[] = [{ path: root }];
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const folder = join(root, entry.name);
      targets.push({ path: folder });
      for (const path of subdirectories(folder)) targets.push({ path });
    }
  } catch {
    // The folder went away between the check and the read; the next refresh settles it
  }
  return targets;
}

/** Every folder below a theme folder, so an asset edited in a nested folder is noticed too. */
function subdirectories(root: string, depth = 0): string[] {
  const found: string[] = [];
  if (depth >= MAX_WATCH_DEPTH) return found;
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = join(root, entry.name);
      found.push(path);
      for (const nested of subdirectories(path, depth + 1)) found.push(nested);
    }
  } catch {
    return found;
  }
  return found;
}

function rewatch(): void {
  for (const watcher of watchers) watcher.close();
  watchers = [];
  const roots = [globalRoot(), projectThemes()].filter(
    (root): root is string => root !== undefined,
  );
  const seen = new Set<string>();
  for (const root of roots) {
    for (const target of targetsFor(root)) {
      const key = `${target.path}\0${target.child ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const watcher = watch(target.path, { persistent: false }, (_event, filename) => {
          // An ancestor is watched only for the folder that leads to the theme root
          if (target.child !== undefined && filename !== null && filename !== target.child) {
            return;
          }
          schedule();
        });
        watcher.on("error", schedule);
        watchers.push(watcher);
      } catch {
        // A path that cannot be watched is tried again on the next refresh
      }
    }
  }
}

/** Reads the global theme folder and starts watching it for changes. */
export function startThemeWatcher(): void {
  if (started) return;
  started = true;
  refresh();
}

/** The list the renderer reads when it starts. */
export function getImportedThemes(): readonly ImportedTheme[] {
  return current;
}

/** Follows the theme folder of the open project; null when no folder is open. */
export function setProjectThemeRoot(root: string | null): void {
  projectRoot = root ?? undefined;
  if (started) refresh();
}

/** Opens the folder a user drops themes into, creating it when it is missing. */
export async function revealThemeFolder(source: ImportedTheme["source"]): Promise<void> {
  const root = source === "global" ? globalRoot() : projectThemes();
  if (root === undefined) return;
  mkdirSync(root, { recursive: true });
  await shell.openPath(root);
}

export function stopThemeWatcher(): void {
  started = false;
  clearTimeout(timer);
  timer = undefined;
  for (const watcher of watchers) watcher.close();
  watchers = [];
}
