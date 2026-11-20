import { join } from "node:path";
import { app } from "electron";
import { z } from "zod";
import { broadcast } from "../broadcast";
import { readJsonFile, writeJsonFile } from "../json-file";

const MAX_RECENT_FILES = 10;
const recentFilesSchema = z.array(z.string()).catch([]);
const listeners = new Set<() => void>();
let recentFiles: string[] | undefined;

function storePath(): string {
  return join(app.getPath("userData"), "recent-files.json");
}

export function getRecentFiles(): readonly string[] {
  recentFiles ??= recentFilesSchema.parse(readJsonFile(storePath()));
  return recentFiles;
}

function save(next: string[]): void {
  recentFiles = next;
  writeJsonFile(storePath(), next);
  broadcast("recent-files:changed", next);
  for (const listener of listeners) listener();
}

export function addRecentFile(path: string): void {
  save([path, ...getRecentFiles().filter((p) => p !== path)].slice(0, MAX_RECENT_FILES));
  app.addRecentDocument(path);
}

export function removeRecentFile(path: string): void {
  save(getRecentFiles().filter((p) => p !== path));
}

export function clearRecentFiles(): void {
  save([]);
  app.clearRecentDocuments();
}

export function onRecentFilesChange(listener: () => void): void {
  listeners.add(listener);
}
