import { posix, win32 } from "node:path";

export const REPOSITORY_URL = "https://github.com/shalemore/pupitre";

/** The app keeps its name in every language, so the report title does too. */
const APP_NAME = "Pupitre";

/** The issue form the report opens; the trackers of the project offer no blank issue. */
const BUG_REPORT_FORM = "bug_report.yml";

/**
 * What the report says about the machine the app runs on. It names the log file and never reads
 * it: what the user attaches is their choice.
 */
export interface DiagnosticsInfo {
  appVersion: string;
  electronVersion: string;
  platform: string;
  arch: string;
  osRelease: string;
  logFilePath: string;
  homeDirectory: string;
}

/**
 * The bug report form, prefilled through the query parameters GitHub names after the fields' ids.
 * The form itself asks what happened: the address carries the diagnostics and nothing else, and
 * the log stays where it is until the user attaches it to the issue.
 */
export function reportIssueUrl(info: DiagnosticsInfo): string {
  const query = new URLSearchParams({
    template: BUG_REPORT_FORM,
    title: `${APP_NAME} ${info.appVersion}: `,
    version: info.appVersion,
    // The form has no field of its own for the runtime, and which Electron version ran matters
    platform: `${info.platform} ${info.osRelease} ${info.arch} · Electron ${info.electronVersion}`,
    log: relativeToHome(info.logFilePath, info.homeDirectory),
  });
  return `${REPOSITORY_URL}/issues/new?${query.toString()}`;
}

/** A Windows path starts with a drive letter or a UNC share, whatever machine reads it. */
const WINDOWS_PATH = /^(?:[a-z]:[\\/]|\\\\)/i;

/**
 * The path as the user knows it, so a public issue does not carry the name of their account. A path
 * outside the home folder — a temporary profile, a log directory on another drive — stays whole.
 * The path is read in the dialect it was written in: the report is built from the machine the app
 * runs on, not necessarily from the one that runs this code.
 */
function relativeToHome(path: string, home: string): string {
  const api = WINDOWS_PATH.test(home) || WINDOWS_PATH.test(path) ? win32 : posix;
  const rel = api.relative(home, path);
  if (rel === "") return "~";
  if (rel.startsWith("..") || api.isAbsolute(rel)) return path;
  return api.join("~", rel);
}
