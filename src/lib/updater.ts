import { createSignal } from "solid-js";
import { isTauri } from "@/lib/platform";
import type { Update } from "@tauri-apps/plugin-updater";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "upToDate"
  | "downloading"
  | "ready"
  | "error";

export interface UpdateInfo {
  version: string;
  date?: string | undefined;
  body?: string | undefined;
}

const [status, setStatus] = createSignal<UpdateStatus>("idle");
const [updateInfo, setUpdateInfo] = createSignal<UpdateInfo | null>(null);
const [progress, setProgress] = createSignal<number>(0);
const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

let activeUpdate: Update | null = null;

export const updaterState = {
  status,
  updateInfo,
  progress,
  errorMessage,
};

export async function checkForUpdates(manual = true): Promise<UpdateInfo | null> {
  if (!isTauri()) {
    if (manual) {
      setStatus("upToDate");
    }
    return null;
  }

  try {
    setStatus("checking");
    setErrorMessage(null);

    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();

    if (update) {
      activeUpdate = update;
      const info: UpdateInfo = {
        version: update.version,
        date: update.date,
        body: update.body,
      };
      setUpdateInfo(info);
      setStatus("available");
      return info;
    }

    activeUpdate = null;
    setUpdateInfo(null);
    setStatus("upToDate");
    return null;
  } catch (err) {
    console.error("Failed to check for updates:", err);
    activeUpdate = null;
    setStatus("error");
    setErrorMessage(err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function downloadAndInstallUpdate(): Promise<void> {
  if (!activeUpdate) return;

  try {
    setStatus("downloading");
    setProgress(0);
    setErrorMessage(null);

    let contentLength = 0;
    let downloaded = 0;

    await activeUpdate.downloadAndInstall((event) => {
      if (event.event === "Started") {
        contentLength = event.data.contentLength ?? 0;
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        if (contentLength > 0) {
          setProgress(Math.min(100, Math.round((downloaded / contentLength) * 100)));
        }
      } else if (event.event === "Finished") {
        setProgress(100);
      }
    });

    setStatus("ready");
  } catch (err) {
    console.error("Failed to download/install update:", err);
    setStatus("error");
    setErrorMessage(err instanceof Error ? err.message : String(err));
  }
}

export async function relaunchApp(): Promise<void> {
  try {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (err) {
    console.error("Failed to relaunch:", err);
  }
}
