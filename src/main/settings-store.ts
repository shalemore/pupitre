import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { app, BrowserWindow, nativeTheme } from "electron";
import { type Settings, settingsSchema } from "@shared/settings";

const listeners = new Set<(settings: Settings) => void>();
let current: Settings | undefined;

export function getSettingsPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

function load(): Settings {
  try {
    const raw: unknown = JSON.parse(readFileSync(getSettingsPath(), "utf8"));
    return settingsSchema.parse(raw);
  } catch {
    // A missing or corrupt file starts from the defaults; the next save writes complete settings
    return settingsSchema.parse({});
  }
}

export function getSettings(): Settings {
  current ??= load();
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = settingsSchema.parse({ ...getSettings(), ...patch });
  const path = getSettingsPath();
  mkdirSync(dirname(path), { recursive: true });
  // Write a temporary file and rename it, so a crash halfway never leaves truncated JSON
  writeFileSync(`${path}.tmp`, JSON.stringify(current, null, 2));
  renameSync(`${path}.tmp`, path);

  nativeTheme.themeSource = current.colorScheme;
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("settings:changed", current);
  }
  for (const listener of listeners) listener(current);
}

export function onSettingsChange(listener: (settings: Settings) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addRecentFile(path: string): void {
  const recentFiles = [path, ...getSettings().recentFiles.filter((p) => p !== path)].slice(0, 10);
  updateSettings({ recentFiles });
  app.addRecentDocument(path);
}
