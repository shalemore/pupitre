import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { watch, type FSWatcher } from "chokidar";
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
 * A root that does not exist yet is still watched through its parent, and the watch moves to the
 * root once it appears.
 */
function watchRoot(root: string): void {
  const watcher = watch(root, { ignoreInitial: true, persistent: false });
  watcher.on("all", () => refreshLater.schedule());
  watcher.on("error", () => refreshLater.schedule());
  watchers.push(watcher);
}

function rewatch(): void {
  for (const watcher of watchers) void watcher.close();
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
  for (const watcher of watchers) void watcher.close();
  watchers = [];
}
