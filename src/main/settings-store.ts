import { join } from "node:path";
import { app, BrowserWindow, nativeTheme } from "electron";
import { z } from "zod";
import {
  DEFAULT_SETTINGS,
  resolveSettings,
  SETTING_KEYS,
  type SettingKey,
  type Settings,
} from "@shared/settings";
import { readJsonFile, writeJsonFile } from "./json-file";

const fileObjectSchema = z.record(z.string(), z.unknown()).catch({});
const listeners = new Set<(settings: Settings) => void>();

/**
 * The settings file as written on disk. Only keys the user changed are present; entries this
 * version does not understand (or that are invalid) are kept untouched, like an editor would.
 */
let file: Record<string, unknown> | undefined;
let current: Settings | undefined;

export function getSettingsPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

function settingsFile(): Record<string, unknown> {
  file ??= fileObjectSchema.parse(readJsonFile(getSettingsPath()));
  return file;
}

export function getSettings(): Settings {
  current ??= resolveSettings(settingsFile());
  return current;
}

function save(next: Record<string, unknown>): void {
  file = next;
  writeJsonFile(getSettingsPath(), next);
  current = resolveSettings(next);
  nativeTheme.themeSource = current.colorScheme;
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("settings:changed", current);
  }
  for (const listener of listeners) listener(current);
}

/** Values equal to the default are removed from the file instead of being written. */
export function updateSettings(patch: Partial<Settings>): void {
  const next = { ...settingsFile() };
  for (const key of SETTING_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value === undefined || Object.is(value, DEFAULT_SETTINGS[key])) delete next[key];
    else next[key] = value;
  }
  save(next);
}

export function resetSetting(key: SettingKey): void {
  const next = { ...settingsFile() };
  delete next[key];
  save(next);
}

export function onSettingsChange(listener: (settings: Settings) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
