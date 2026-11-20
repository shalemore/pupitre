import type { DesktopApi } from "@pupitre/desktop-api";

declare global {
  interface Window {
    /** Injected by the preload script, see src/preload/index.ts. */
    readonly desktop: DesktopApi;
  }
}
