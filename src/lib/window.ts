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
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_settings_window", { title: t().settings.title });
      return;
    } catch (err) {
      console.warn("Failed to open native settings window via invoke:", err);
    }
  }

  const url = `${window.location.origin}${window.location.pathname}?view=settings#settings`;
  const popup = window.open(
    url,
    "Pupitre Preferences",
    "width=720,height=560,menubar=no,toolbar=no,location=no,status=no",
  );
  popup?.focus();
}

/**
 * Open the About dialog in a dedicated native OS window.
 * On desktop (Tauri), this spawns or focuses a standalone native window.
 */
export async function openAboutWindow(): Promise<void> {
  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_about_window", { title: t().about.windowTitle });
      return;
    } catch (err) {
      console.warn("Failed to open native about window via invoke:", err);
    }
  }

  const url = `${window.location.origin}${window.location.pathname}?view=about#about`;
  const popup = window.open(
    url,
    "About Pupitre",
    "width=480,height=360,menubar=no,toolbar=no,location=no,status=no",
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
 * Close current native window (hides the window if it's the settings window to allow instant re-open).
 */
export async function closeCurrentWindow(): Promise<void> {
  const win = await getCurrentAppWindow();
  if (win) {
    if (win.label === "settings" || win.label === "about") {
      await win.hide();
      return;
    }
    await win.close();
    return;
  }
  window.close();
}
