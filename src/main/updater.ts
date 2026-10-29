import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { app, Notification } from "electron";
import log from "electron-log/main";
import electronUpdater from "electron-updater";
import type { UpdateStatus } from "@shared/desktop-api";
import { messageOf } from "@shared/errors";
import { broadcast } from "./broadcast";
import { t } from "./i18n";
import { getSettings } from "./settings-store";
import { showSettingsWindow } from "./windows";

const { autoUpdater } = electronUpdater;

let status: UpdateStatus = { kind: "idle" };
// The startup check runs in the background with no UI waiting for the result, so a new version is announced with a system notification
let notifyWhenAvailable = false;

function setStatus(next: UpdateStatus): void {
  status = next;
  broadcast("updater:status", status);
}

function releaseNotes(
  notes: string | readonly { note: string | null }[] | null | undefined,
): string {
  if (typeof notes === "string") return notes;
  return (notes ?? []).flatMap(({ note }) => (note === null ? [] : [note])).join("\n\n");
}

// Only the Windows installer writes an uninstaller next to the executable. A copy without one was
// unpacked by a package manager such as Scoop, and the installer an update would run is not what
// that package manager installed.
export const canSelfUpdate =
  !app.isPackaged ||
  process.platform !== "win32" ||
  existsSync(join(dirname(app.getPath("exe")), `Uninstall ${app.getName()}.exe`));

export function setupUpdater(): void {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;
  autoUpdater.on("checking-for-update", () => setStatus({ kind: "checking" }));
  autoUpdater.on("update-available", (info) => {
    setStatus({ kind: "available", version: info.version, notes: releaseNotes(info.releaseNotes) });
    if (notifyWhenAvailable && Notification.isSupported()) {
      const notification = new Notification({
        title: t().settings.updateNotificationTitle(info.version),
        body: t().settings.updateNotificationBody,
      });
      notification.on("click", showSettingsWindow);
      notification.show();
    }
    notifyWhenAvailable = false;
  });
  autoUpdater.on("update-not-available", () => {
    notifyWhenAvailable = false;
    setStatus({ kind: "up-to-date" });
  });
  autoUpdater.on("download-progress", ({ percent }) =>
    setStatus({ kind: "downloading", percent: Math.round(percent) }),
  );
  autoUpdater.on("update-downloaded", (info) =>
    setStatus({ kind: "ready", version: info.version }),
  );
  autoUpdater.on("error", (error) => setStatus({ kind: "error", message: messageOf(error) }));
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

/** Checks for updates once in the background at startup if the setting allows it; failures stay silent. */
export function checkForUpdatesOnStartup(): void {
  if (!app.isPackaged || !canSelfUpdate || !getSettings().autoCheckUpdates) return;
  // Let the window paint and the first document load before the update client uses the network
  setTimeout(() => {
    notifyWhenAvailable = true;
    autoUpdater.checkForUpdates().catch(() => {
      notifyWhenAvailable = false;
    });
  }, 4000);
}

export async function downloadUpdate(): Promise<void> {
  await autoUpdater.downloadUpdate();
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall();
}
