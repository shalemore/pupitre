import { statSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { app, nativeTheme, shell } from "electron";
import type { WorkspaceState } from "@shared/desktop-api";
import {
  DEFAULT_SETTINGS,
  isWorkspaceKey,
  patchSettingsFile,
  resolveSettings,
  SETTING_KEYS,
  type SettingKey,
  type Settings,
  settingsFileSchema,
  withoutSetting,
  WORKSPACE_FILE,
} from "@shared/settings";
import { broadcast } from "../broadcast";
import { readJsonFile, writeJsonFile } from "../json-file";

const listeners = new Set<(settings: Settings) => void>();

/**
 * The settings file as written on disk. Only keys the user changed are present; entries this
 * version does not understand (or that are invalid) are kept untouched, like an editor would.
 */
let file: Record<string, unknown> | undefined;
let current: Settings | undefined;
let firstRun = false;

/**
 * The open folder and its own settings file. While `workspaceActive`, its values are laid over the
 * global ones, key by key, and what the user changes goes to it instead of the global file. The
 * file is created by the first change, never by switching to it.
 */
interface Workspace {
  root: string;
  path: string;
  file: Record<string, unknown>;
  exists: boolean;
}
let workspace: Workspace | undefined;
let workspaceActive = false;

export function getSettingsPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

/**
 * Keys an older version wrote into the settings file that are not settings. Recent files moved to
 * a file of their own; the list changes with every document opened, so it must not sit among the
 * preferences a user syncs or keeps in version control.
 */
const LEGACY_STATE_KEYS = ["recentFiles"] as const;

/** Removes those keys from a settings file read from disk, and says whether one was there. */
function dropLegacyState(settings: Record<string, unknown>): boolean {
  let found = false;
  for (const key of LEGACY_STATE_KEYS) {
    if (!(key in settings)) continue;
    delete settings[key];
    found = true;
  }
  return found;
}

/** The settings file at `path`, parsed and migrated; `exists` is false when there was none. */
function readSettingsFile(path: string): { settings: Record<string, unknown>; exists: boolean } {
  const raw = readJsonFile(path);
  const settings = settingsFileSchema.parse(raw);
  // Drop what an older version left behind before anything is synced again
  if (raw !== undefined && dropLegacyState(settings)) writeJsonFile(path, settings);
  return { settings, exists: raw !== undefined };
}

function settingsFile(): Record<string, unknown> {
  if (file === undefined) {
    const { settings, exists } = readSettingsFile(getSettingsPath());
    firstRun = !exists;
    file = settings;
  }
  return file;
}

/** Whether there was no settings file when the app started, so nothing has been chosen yet. */
export function isFirstRun(): boolean {
  settingsFile();
  return firstRun;
}

/** What the settings are read from: the global file, with the folder's values laid over it. */
function effectiveFile(): Record<string, unknown> {
  if (!workspace || !workspaceActive) return settingsFile();
  const merged = { ...settingsFile() };
  for (const [key, value] of Object.entries(workspace.file)) {
    if (isWorkspaceKey(key)) merged[key] = value;
  }
  return merged;
}

export function getSettings(): Settings {
  current ??= resolveSettings(effectiveFile());
  return current;
}

export function getWorkspaceState(): WorkspaceState {
  return {
    root: workspace?.root ?? null,
    active: workspaceActive,
    exists: workspace?.exists ?? false,
    overrides: SETTING_KEYS.filter(
      (key) => isWorkspaceKey(key) && workspace !== undefined && key in workspace.file,
    ),
  };
}

/** Recomputes the settings from the files and tells every window and listener. */
function publish(): void {
  current = resolveSettings(effectiveFile());
  nativeTheme.themeSource = current.colorScheme;
  broadcast("settings:changed", current);
  broadcast("workspace:changed", getWorkspaceState());
  for (const listener of listeners) listener(current);
}

function saveGlobal(next: Record<string, unknown>): void {
  file = next;
  writeJsonFile(getSettingsPath(), next);
}

function saveWorkspace(next: Record<string, unknown>): void {
  if (!workspace) return;
  const changed = !isDeepStrictEqual(next, workspace.file);
  workspace.file = next;
  // The file appears with the first real change and stays, even if later values match the others
  if (!changed) return;
  writeJsonFile(workspace.path, next);
  workspace.exists = true;
}

/**
 * Values equal to what they would be without the entry are removed instead of written: the
 * default for the global file, the global value for the folder's.
 */
export function updateSettings(patch: Partial<Settings>): void {
  const folder = workspaceActive ? workspace : undefined;
  const global = (key: SettingKey) => folder === undefined || !isWorkspaceKey(key);
  const inherited = resolveSettings(settingsFile());
  if (SETTING_KEYS.some((key) => key in patch && global(key))) {
    saveGlobal(patchSettingsFile(settingsFile(), patch, DEFAULT_SETTINGS, global));
  }
  if (folder) {
    saveWorkspace(patchSettingsFile(folder.file, patch, inherited, (key) => !global(key)));
  }
  publish();
}

/** In the folder's settings this gives the key back to the global value. */
export function resetSetting(key: SettingKey): void {
  if (workspace && workspaceActive && isWorkspaceKey(key)) {
    saveWorkspace(withoutSetting(workspace.file, key));
  } else {
    saveGlobal(withoutSetting(settingsFile(), key));
  }
  publish();
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Tells which folder is open. A folder with a settings file uses it right away; one without
 * keeps using the global settings until the user chooses its own.
 */
export function setWorkspace(root: string | null): void {
  if (root === null || !isDirectory(root)) {
    if (workspace === undefined) return;
    workspace = undefined;
    workspaceActive = false;
  } else if (workspace?.root !== root) {
    const path = join(root, WORKSPACE_FILE);
    const { settings, exists } = readSettingsFile(path);
    workspace = { root, path, exists, file: settings };
    workspaceActive = exists;
  } else {
    return;
  }
  publish();
}

/** Chooses between the settings of the open folder and the global ones. */
export function useWorkspace(active: boolean): void {
  if (!workspace || workspaceActive === active) return;
  workspaceActive = active;
  publish();
}

export function revealWorkspaceFile(): void {
  if (workspace?.exists) shell.showItemInFolder(workspace.path);
}

export function onSettingsChange(listener: (settings: Settings) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
