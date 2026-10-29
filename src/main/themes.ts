import { existsSync, mkdirSync, watch, type FSWatcher } from "node:fs";
import { basename, dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { app, shell } from "electron";
import type { ImportedTheme } from "@shared/desktop-api";
import { broadcast } from "./broadcast";
import { createDebouncedTask } from "./debounced-task";
import { readThemesFromRoot } from "./theme-folders";

/** A write may arrive as several events, such as a temporary file and the rename after it. */
const REFRESH_DELAY = 120;

let started = false;
let projectRoot: string | undefined;
let current: readonly ImportedTheme[] = [];
let watchers: FSWatcher[] = [];

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

function refresh(): void {
  const next = readAll();
  const changed = !isDeepStrictEqual(next, current);
  current = next;
  if (changed) broadcast("themes:changed", current);
  rewatch();
}

const refreshLater = createDebouncedTask(refresh, REFRESH_DELAY);

/**
 * Watches `root` and every folder below it, so an asset edited in a nested folder is noticed too.
 * A root that does not exist yet is found by watching its deepest existing ancestor for the folder
 * that leads to it; once it appears, the next refresh watches the root itself.
 */
function watchRoot(root: string): void {
  let existing = root;
  let missing = "";
  while (!existsSync(existing)) {
    missing = basename(existing);
    const parent = dirname(existing);
    if (parent === existing) return;
    existing = parent;
  }
  const child = missing === "" ? undefined : missing;
  try {
    const watcher = watch(
      existing,
      { persistent: false, recursive: child === undefined },
      (_event, filename) => {
        // An ancestor is watched only for the folder that leads to the theme root
        if (child !== undefined && filename !== null && filename !== child) return;
        refreshLater.schedule();
      },
    );
    watcher.on("error", refreshLater.schedule);
    watchers.push(watcher);
  } catch {
    // A path that cannot be watched is tried again on the next refresh
  }
}

function rewatch(): void {
  for (const watcher of watchers) watcher.close();
  watchers = [];
  const roots = [globalRoot(), projectThemes()].filter(
    (root): root is string => root !== undefined,
  );
  for (const root of new Set(roots)) watchRoot(root);
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
  refreshLater.cancel();
  for (const watcher of watchers) watcher.close();
  watchers = [];
}
