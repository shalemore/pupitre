import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { shell } from "electron";
import type { DefaultAppResult } from "@shared/desktop-api";

/**
 * Making Pupitre the default app for Markdown files. The installers register Pupitre as a handler
 * (fileAssociations in electron-builder.yml, removed again on uninstall); choosing the default is
 * left to the system where it does not allow apps to do it themselves:
 *
 * - Windows 10 and later only let the user change defaults, so the Default apps page is opened.
 * - macOS has no public API for it outside of Launch Services, so the user gets instructions.
 * - Linux desktops follow xdg-mime, which an app may set.
 */
export async function setAsDefaultMarkdownApp(): Promise<DefaultAppResult> {
  switch (process.platform) {
    case "win32":
      await shell.openExternal("ms-settings:defaultapps");
      return "opened-settings";
    case "linux":
      try {
        // electron-builder names the desktop entry after the executable
        await promisify(execFile)("xdg-mime", ["default", "pupitre.desktop", "text/markdown"]);
        return "done";
      } catch {
        return "failed";
      }
    default:
      return "manual";
  }
}
