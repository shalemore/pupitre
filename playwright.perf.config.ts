import { defineConfig } from "@playwright/test";

/**
 * The performance spec opens documents of megabytes and types into them, which takes minutes and
 * says little on a machine other than the one it ran on. `npm run test:e2e` leaves it out with a
 * testIgnore, and this config runs only it.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /performance\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  // A cold start and a 20 MB open have to fit, even where the disk is slow
  timeout: 600_000,
  expect: { timeout: 10_000 },
  // Electron only downloads its binary once something requires it, and the cold start below must
  // not be the step that pays for the download
  globalSetup: "./e2e/global-setup.ts",
  reporter: "list",
  use: { trace: "off" },
});
