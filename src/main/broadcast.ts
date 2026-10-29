import { BrowserWindow } from "electron";
import type { RendererEvents } from "@shared/desktop-api";

/** Sends an event to every open window, typed by the contract the renderer listens on. */
export function broadcast<K extends keyof RendererEvents>(
  channel: K,
  payload: RendererEvents[K],
): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
}
