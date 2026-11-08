import { resolve } from "node:path";
import { app } from "electron";
import { DOCUMENT_FILE, IMAGE_FILE } from "@shared/desktop-api";
import { createMainWindow, dispatchToMainWindow, getMainWindow } from "../windows/windows";

let launchFile: string | undefined;

/**
 * The file the system asked Pupitre to open at launch, handed to the first main window through its
 * initial state so it replaces the startup page instead of racing it.
 */
export function takeLaunchFile(): string | undefined {
  const file = launchFile;
  launchFile = undefined;
  return file;
}

/** Windows and Linux pass the file as an argument; Chromium may add its own switches. */
function fileFromArgv(argv: readonly string[], workingDirectory: string): string | undefined {
  // argv starts with the executable, and with the app folder as well when Electron runs the app
  const file = argv
    .slice(process.defaultApp ? 2 : 1)
    .find((arg) => !arg.startsWith("-") && (DOCUMENT_FILE.test(arg) || IMAGE_FILE.test(arg)));
  return file === undefined ? undefined : resolve(workingDirectory, file);
}

/** The file this instance was started with, which the single-instance lock hands to the first one. */
export function launchFileFromArgv(): string | undefined {
  return fileFromArgv(process.argv, process.cwd());
}

/** The file a second instance handed over, when it sent one. */
function handedFile(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null || !("file" in data)) return undefined;
  return typeof data.file === "string" ? data.file : undefined;
}

function openFile(path: string): void {
  const window = getMainWindow();
  if (!window) {
    launchFile = path;
    if (app.isReady()) createMainWindow();
    return;
  }
  const open = () => dispatchToMainWindow({ id: "file.open-path", path });
  if (window.webContents.isLoading()) window.webContents.once("did-finish-load", open);
  else open();
}

/** Call before the app is ready: macOS reports files opened at launch with open-file early. */
export function handleOpenFileRequests(): void {
  launchFile = launchFileFromArgv();

  app.on("open-file", (event, path) => {
    event.preventDefault();
    openFile(path);
  });

  app.on("second-instance", (_event, argv, workingDirectory, additionalData) => {
    // The lock carries the file the second instance was started with; its argv may have been reordered
    const file = handedFile(additionalData) ?? fileFromArgv(argv, workingDirectory);
    if (file) {
      openFile(file);
      return;
    }
    const window = getMainWindow();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });
}
