import { BrowserWindow, type WebContents } from "electron";
import type { RendererEvents } from "@shared/desktop-api";

/** Sends an event to one window, typed by the contract the renderer listens on. */
export function sendTo<K extends keyof RendererEvents>(
  webContents: WebContents,
  channel: K,
  payload: RendererEvents[K],
): void {
  webContents.send(channel, payload);
}

/** Sends an event to every open window, typed by the contract the renderer listens on. */
export function broadcast<K extends keyof RendererEvents>(
  channel: K,
  payload: RendererEvents[K],
): void {
  for (const window of BrowserWindow.getAllWindows()) {
    sendTo(window.webContents, channel, payload);
  }
}
