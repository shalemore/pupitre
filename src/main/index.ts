import { join } from "node:path";
import { app, BrowserWindow, nativeTheme, session } from "electron";
import { setupDiagnostics } from "./diagnostics";
import { flushDraft } from "./drafts";
import { registerIpcHandlers } from "./ipc";
import { allowMacTypeInjection } from "./mactype";
import { rebuildApplicationMenu } from "./menu";
import { handleOpenFileRequests } from "./open-files";
import { onRecentFilesChange } from "./recent-files";
import { getSettings, onSettingsChange } from "./settings-store";
import { applySpellCheck } from "./spellcheck";
import { startThemeWatcher, stopThemeWatcher } from "./themes";
import { checkForUpdatesOnStartup, setupUpdater } from "./updater";
import { flushWindowState } from "./window-state";
import { createMainWindow } from "./windows";

allowMacTypeInjection();
// Groups the taskbar button and attributes notifications to the app; electron-builder uses the same id
app.setAppUserModelId("com.shalemore.pupitre");
// The log and the crash dumps a report may point at, before a crash or a second instance can happen
setupDiagnostics();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  handleOpenFileRequests();

  void app.whenReady().then(() => {
    nativeTheme.themeSource = getSettings().colorScheme;

    // The font picker reads system fonts through queryLocalFonts, which needs the local-fonts permission
    session.defaultSession.setPermissionCheckHandler(
      (_webContents, permission) => permission === "local-fonts",
    );
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) =>
      callback(permission === "local-fonts"),
    );

    if (!app.isPackaged) app.dock?.setIcon(join(app.getAppPath(), "build/icon.png"));

    registerIpcHandlers();
    startThemeWatcher();
    setupUpdater();
    rebuildApplicationMenu();
    createMainWindow();
    applySpellCheck();
    onSettingsChange(rebuildApplicationMenu);
    onSettingsChange(applySpellCheck);
    onRecentFilesChange(rebuildApplicationMenu);
    checkForUpdatesOnStartup();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("window-all-closed", () => app.quit());
  // A draft or the window state written as the window closed may still be waiting to reach the disk
  app.on("will-quit", () => {
    flushDraft();
    flushWindowState();
    stopThemeWatcher();
  });
}
