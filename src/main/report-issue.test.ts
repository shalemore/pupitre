import { describe, expect, it } from "vitest";
import { type DiagnosticsInfo, reportIssueUrl } from "./report-issue";

const INFO: DiagnosticsInfo = {
  appVersion: "0.7.2",
  electronVersion: "45.0.0",
  platform: "win32",
  arch: "x64",
  osRelease: "10.0.22631",
  logFilePath: "C:\\Users\\ana\\AppData\\Roaming\\Pupitre\\logs\\main.log",
  homeDirectory: "C:\\Users\\ana",
};

function newIssuePage(info: DiagnosticsInfo = INFO) {
  return new URL(reportIssueUrl(info));
}

describe("reportIssueUrl", () => {
  it("opens the new-issue page of the project's tracker", () => {
    expect(newIssuePage().origin + newIssuePage().pathname).toBe(
      "https://github.com/shalemore/pupitre/issues/new",
    );
  });

  it("opens the bug report form, since a blank issue is turned off", () => {
    expect(newIssuePage().searchParams.get("template")).toBe("bug_report.yml");
  });

  it("titles the issue with the version, ready for the rest of the line", () => {
    expect(newIssuePage().searchParams.get("title")).toBe("Pupitre 0.7.2: ");
  });

  it("fills the version field of the form", () => {
    expect(newIssuePage().searchParams.get("version")).toBe("0.7.2");
  });

  it("fills the platform field with the system and the Electron version the form cannot ask for", () => {
    expect(newIssuePage().searchParams.get("platform")).toBe(
      "win32 10.0.22631 x64 · Electron 45.0.0",
    );
  });

  it("names the log file relative to the home folder, so no account name travels with it", () => {
    expect(newIssuePage().searchParams.get("log")).toBe(
      "~\\AppData\\Roaming\\Pupitre\\logs\\main.log",
    );
  });

  it("keeps a log path outside the home folder whole", () => {
    const profile: DiagnosticsInfo = {
      ...INFO,
      logFilePath: "/tmp/pupitre-e2e-k2f9/profile/logs/main.log",
      homeDirectory: "/home/ana",
    };
    expect(newIssuePage(profile).searchParams.get("log")).toBe(
      "/tmp/pupitre-e2e-k2f9/profile/logs/main.log",
    );
  });

  it("leaves the body to the form rather than encoding one into the query", () => {
    const url = reportIssueUrl(INFO);
    expect(url).not.toContain("\n");
    expect(url).not.toContain("body=");
    expect(newIssuePage().searchParams.has("body")).toBe(false);
  });
});
