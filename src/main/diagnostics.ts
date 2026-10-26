import { join } from "node:path";
import { app, crashReporter } from "electron";
import log from "electron-log/main";
import type { DiagnosticsInfo } from "./report-issue";

/**
 * The levels the file takes, from the one that keeps the most to the one that keeps the least.
 * PUPITRE_LOG_LEVEL picks another one for a single run, which is what a bug report often needs.
 */
const LOG_LEVELS = ["silly", "debug", "verbose", "info", "warn", "error"] as const;

/**
 * Sends the logs to a file in the app's own logs folder and tells Crashpad to keep its dumps on
 * this machine. Nothing here leaves the computer: a report carries the path, not the contents.
 *
 * Runs before `whenReady`: Crashpad has to start that early to catch a crash during startup, and
 * the log file's path is resolved on the first line rather than now.
 */
export function setupDiagnostics(): void {
  const requestedLevel = process.env["PUPITRE_LOG_LEVEL"];
  const level = LOG_LEVELS.find((known) => known === requestedLevel);
  log.transports.file.level = level ?? "info";
  // Small enough to attach to an issue, big enough to keep a few sessions before it rotates
  log.transports.file.maxSize = 5 * 1024 * 1024;
  // Electron's own logs folder, so the path in a report is the one the system expects
  log.transports.file.resolvePathFn = () => join(app.getPath("logs"), "main.log");
  log.errorHandler.startCatching({ showDialog: false });

  crashReporter.start({ uploadToServer: false });

  log.info(`Pupitre ${app.getVersion()} started on ${process.platform} ${process.arch}`);
  if (requestedLevel !== undefined && level === undefined) {
    log.warn(`Unknown PUPITRE_LOG_LEVEL, logging at info: ${requestedLevel}`);
  }
}

/** The versions and the log path the issue report fills in. */
export function diagnosticsInfo(): DiagnosticsInfo {
  return {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    platform: process.platform,
    arch: process.arch,
    osRelease: process.getSystemVersion(),
    logFilePath: log.transports.file.getFile().path,
  };
}
