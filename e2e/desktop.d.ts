import type { DesktopApi } from "../src/shared/desktop-api";

declare global {
  interface Window {
    /** Injected by the preload script, see src/preload/index.ts. */
    readonly desktop: DesktopApi;
  }
}
