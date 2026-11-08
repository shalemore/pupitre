import type { DesktopApi } from "./desktop-api";

declare global {
  interface Window {
    /** Injected by the host: the preload script through contextBridge, or the web demo's own. */
    readonly desktop: DesktopApi;
  }
}

/** The host the renderer talks to; every window of the app has one before its scripts run. */
export const desktop = window.desktop;
export const isMacOS = desktop.platform === "darwin";
