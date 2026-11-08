import { defineConfig } from "@playwright/test";
import { sharedConfig } from "./playwright.shared.js";

// One Electron app at a time: every launch starts its own profile, and the app itself already uses
// most of a core while it parses a document.
export default defineConfig({
  ...sharedConfig,
  // A cold Electron start on CI can take a while before the first window paints
  timeout: 60_000,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  // The performance spec opens documents of megabytes and takes minutes, so it has a config of its own
  testIgnore: /performance\.spec\.ts$/,
  reporter: process.env["CI"] ? "github" : "list",
  use: { trace: "retain-on-failure" },
});
