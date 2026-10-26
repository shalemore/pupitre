export const REPOSITORY_URL = "https://github.com/shalemore/pupitre";

/** The app keeps its name in every language, so the report title does too. */
const APP_NAME = "Pupitre";

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
}

/**
 * The GitHub new-issue page, prefilled with the template and the versions. The address alone is
 * what opens; the log stays where it is until the user attaches it to the issue.
 */
export function reportIssueUrl(info: DiagnosticsInfo): string {
  const query = new URLSearchParams({
    title: `${APP_NAME} ${info.appVersion}: `,
    body: reportBody(info),
  });
  return `${REPOSITORY_URL}/issues/new?${query.toString()}`;
}

function reportBody(info: DiagnosticsInfo): string {
  return [
    "**What happened?**",
    "",
    "",
    "**What I expected**",
    "",
    "",
    "---",
    "**Diagnostics**",
    `${APP_NAME}: ${info.appVersion}`,
    `Electron: ${info.electronVersion}`,
    `System: ${info.platform} ${info.osRelease} ${info.arch}`,
    // Naming the file rather than inlining it: the log belongs to the machine it was written on
    `Log file: ${info.logFilePath}`,
  ].join("\n");
}
