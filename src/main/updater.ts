import { app, BrowserWindow } from "electron";
import electronUpdater from "electron-updater";
import type { UpdateStatus } from "@shared/desktop-api";

const { autoUpdater } = electronUpdater;

let status: UpdateStatus = { kind: "idle" };

function setStatus(next: UpdateStatus): void {
  status = next;
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("updater:status", status);
  }
}

function releaseNotes(
  notes: string | readonly { note: string | null }[] | null | undefined,
): string {
  if (typeof notes === "string") return notes;
  return (notes ?? []).flatMap(({ note }) => (note === null ? [] : [note])).join("\n\n");
}

export function setupUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.on("checking-for-update", () => setStatus({ kind: "checking" }));
  autoUpdater.on("update-available", (info) =>
    setStatus({ kind: "available", version: info.version, notes: releaseNotes(info.releaseNotes) }),
  );
  autoUpdater.on("update-not-available", () => setStatus({ kind: "up-to-date" }));
  autoUpdater.on("download-progress", ({ percent }) =>
    setStatus({ kind: "downloading", percent: Math.round(percent) }),
  );
  autoUpdater.on("update-downloaded", (info) =>
    setStatus({ kind: "ready", version: info.version }),
  );
  autoUpdater.on("error", (error) => setStatus({ kind: "error", message: error.message }));
}

export function getUpdateStatus(): UpdateStatus {
  return status;
}

export async function checkForUpdates(): Promise<void> {
  // Development builds have no update metadata, so they count as up to date
  if (!app.isPackaged) {
    setStatus({ kind: "up-to-date" });
    return;
  }
  await autoUpdater.checkForUpdates();
}

export async function downloadUpdate(): Promise<void> {
  await autoUpdater.downloadUpdate();
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall();
}
