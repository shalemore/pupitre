import { createRequire } from "node:module";

/**
 * Electron downloads its binary the first time the package is required. Playwright does that inside
 * the first test, where the download would count against the test's timeout, so it happens here.
 */
export default function installElectron(): void {
  createRequire(import.meta.url)("electron");
}
