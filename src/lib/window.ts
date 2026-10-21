import { t } from "@/i18n";
import { isTauri } from "@/lib/platform";

/**
 * Open the Preferences/Settings in a dedicated native OS window.
 * On desktop (Tauri), this spawns or focuses a standalone native window with system decorations.
 * Uses `visible: false` until DOM is ready to eliminate any blank or white flash in both dev and production.
 */
export async function openSettingsWindow(): Promise<void> {
  if (isTauri()) {
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const existing = await WebviewWindow.getByLabel("settings");
      if (existing) {
        await existing.unminimize();
        await existing.show();
        await existing.setFocus();
        return;
      }

      const settingsWin = new WebviewWindow("settings", {
        url: "index.html?view=settings",
        title: t().settings.title,
        width: 720,
        height: 560,
        minWidth: 540,
        minHeight: 440,
        resizable: true,
        center: true,
        decorations: true,
        visible: false, // Hidden until content has painted to prevent flash
        focus: true,
      });

      settingsWin.once("tauri://dom-loaded", async () => {
        try {
          await settingsWin.show();
          await settingsWin.setFocus();
        } catch {
          // ignore
        }
      });

      // Safety timeout fallback
      setTimeout(async () => {
        try {
          const isVis = await settingsWin.isVisible();
          if (!isVis) {
            await settingsWin.show();
            await settingsWin.setFocus();
          }
        } catch {
          // ignore
        }
      }, 500);

      settingsWin.once("tauri://error", (err) => {
        console.error("Failed to create settings window:", err);
      });
      return;
    } catch (err) {
      console.warn("Failed to open native settings window:", err);
    }
  }

  const url = `${window.location.origin}${window.location.pathname}?view=settings`;
  const popup = window.open(
    url,
    "Pupitre Preferences",
    "width=720,height=560,menubar=no,toolbar=no,location=no,status=no",
  );
  popup?.focus();
}

/**
 * Helper to get the current Tauri window instance if available.
 */
export async function getCurrentAppWindow() {
  if (isTauri()) {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      return getCurrentWindow();
    } catch (e) {
      console.error("Failed to load Tauri window module:", e);
      return null;
    }
  }
  return null;
}

export async function minimizeCurrentWindow(): Promise<void> {
  const win = await getCurrentAppWindow();
  await win?.minimize();
}

export async function toggleMaximizeCurrentWindow(): Promise<void> {
  const win = await getCurrentAppWindow();
  await win?.toggleMaximize();
}

export async function isCurrentWindowMaximized(): Promise<boolean> {
  const win = await getCurrentAppWindow();
  if (!win) return false;
  return win.isMaximized();
}

/**
 * Close current native window.
 */
export async function closeCurrentWindow(): Promise<void> {
  const win = await getCurrentAppWindow();
  if (win) {
    await win.close();
    return;
  }
  window.close();
}
