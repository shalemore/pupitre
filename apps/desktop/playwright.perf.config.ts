import { defineConfig } from "@playwright/test";
import { sharedConfig } from "./playwright.shared.js";

/**
 * The performance spec opens documents of megabytes and types into them, which takes minutes and
 * says little on a machine other than the one it ran on. `npm run test:e2e` leaves it out with a
 * testIgnore, and this config runs only it.
 */
export default defineConfig({
  ...sharedConfig,
  testMatch: /performance\.spec\.ts$/,
  // A cold start and a 20 MB open have to fit, even where the disk is slow
  timeout: 600_000,
  reporter: "list",
  use: { trace: "off" },
});
