import { defineConfig } from "@playwright/test";

// One Electron app at a time: every launch starts its own profile, and the app itself already uses
// most of a core while it parses a document.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? "github" : "list",
  use: { trace: "retain-on-failure" },
});
