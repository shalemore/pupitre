import type { UpdateStatus } from "@pupitre/desktop-api";
import { describe, expect, it } from "vitest";
import { type UpdateLabels, updateActionOf } from "./update-action";

const labels: UpdateLabels = {
  checkingForUpdates: "Checking…",
  downloadUpdate: "Download",
  checkForUpdates: "Check for updates",
};

describe("updateActionOf", () => {
  const cases: readonly [UpdateStatus, string, string, boolean][] = [
    [{ kind: "idle" }, "Check for updates", "updater:check", false],
    [{ kind: "checking" }, "Checking…", "updater:check", true],
    [{ kind: "available", version: "1.0.0" }, "Download", "updater:download", false],
    [{ kind: "downloading", percent: 40 }, "Download", "updater:download", true],
    [{ kind: "up-to-date" }, "Check for updates", "updater:check", false],
    [{ kind: "ready", version: "1.0.0" }, "Check for updates", "updater:check", false],
    [{ kind: "error", message: "offline" }, "Check for updates", "updater:check", false],
  ];

  it.each(cases)("offers the right action for %o", (status, label, command, disabled) => {
    const action = updateActionOf(status, labels);
    expect(action).toMatchObject({ label, command, disabled });
  });

  it("turns the refresh icon only while it waits for an answer", () => {
    expect(updateActionOf({ kind: "checking" }, labels).spinning).toBe(true);
    expect(updateActionOf({ kind: "idle" }, labels).spinning).toBe(false);
    expect(updateActionOf({ kind: "available", version: "2" }, labels).spinning).toBe(false);
  });
});
