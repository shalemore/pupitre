import type { PlaywrightTestConfig } from "@playwright/test";

/**
 * What the test run and the performance run share: one Electron app at a time, the same folder,
 * and the binary downloaded before the first window rather than by it.
 */
export const sharedConfig = {
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  expect: { timeout: 10_000 },
  // Electron only downloads its binary once something requires it, and the first test should not
  // pay for that
  globalSetup: "./e2e/global-setup.ts",
} satisfies PlaywrightTestConfig;
