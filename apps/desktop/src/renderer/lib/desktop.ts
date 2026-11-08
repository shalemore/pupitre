import type { DesktopApi } from "@pupitre/desktop-api";

declare global {
  interface Window {
    /** Injected by the preload script through contextBridge, see src/preload/index.ts. */
    readonly desktop: DesktopApi;
  }
}

export const desktop = window.desktop;
export const isMacOS = desktop.platform === "darwin";
