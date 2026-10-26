import { describe, expect, it } from "vitest";
import { type DiagnosticsInfo, reportIssueUrl } from "./report-issue";

const INFO: DiagnosticsInfo = {
  appVersion: "0.7.2",
  electronVersion: "45.0.0",
  platform: "win32",
  arch: "x64",
  osRelease: "10.0.22631",
  logFilePath: "C:\\Users\\ana\\AppData\\Roaming\\Pupitre\\logs\\main.log",
};

function newIssuePage() {
  return new URL(reportIssueUrl(INFO));
}

describe("reportIssueUrl", () => {
  it("opens the new-issue page of the project's tracker", () => {
    expect(newIssuePage().origin + newIssuePage().pathname).toBe(
      "https://github.com/shalemore/pupitre/issues/new",
    );
  });

  it("titles the issue with the version, ready for the rest of the line", () => {
    expect(newIssuePage().searchParams.get("title")).toBe("Pupitre 0.7.2: ");
  });

  it("encodes the body into the query rather than pasting it in", () => {
    const url = reportIssueUrl(INFO);
    expect(url).not.toContain("\n");
    expect(url).toContain("body=");
    expect(newIssuePage().searchParams.get("body")).toContain("**What happened?**");
    expect(newIssuePage().searchParams.get("body")).toContain("**What I expected**");
  });

  it("ends the body with the diagnostics, naming the log file and not its contents", () => {
    const body = newIssuePage().searchParams.get("body") ?? "";
    expect(body.split("\n").slice(-5)).toEqual([
      "**Diagnostics**",
      "Pupitre: 0.7.2",
      "Electron: 45.0.0",
      "System: win32 10.0.22631 x64",
      `Log file: ${INFO.logFilePath}`,
    ]);
  });
});
