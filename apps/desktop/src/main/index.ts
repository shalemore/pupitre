import { join } from "node:path";
import { app, BrowserWindow, nativeTheme, session } from "electron";
import { setupDiagnostics } from "./diagnostics/diagnostics";
import { flushDraft } from "./document/drafts";
import { handleOpenFileRequests, launchFileFromArgv } from "./files/open-files";
import { onRecentFilesChange } from "./files/recent-files";
import { registerIpcHandlers } from "./ipc";
import { rebuildApplicationMenu } from "./menus/menu";
import { getSettings, onSettingsChange } from "./settings/settings-store";
import { startThemeWatcher, stopThemeWatcher } from "./settings/themes";
import { checkForUpdatesOnStartup, setupUpdater } from "./updater";
import { allowMacTypeInjection } from "./windows/mactype";
import { applySpellCheck } from "./windows/spellcheck";
import { flushWindowState } from "./windows/window-state";
import { createMainWindow } from "./windows/windows";

allowMacTypeInjection();
// Groups the taskbar button and attributes notifications to the app; electron-builder uses the same
// id. Only a packaged run sets it: an unpackaged run keeps Electron's identity, so the taskbar does
// not take the icon of an installed build.
if (app.isPackaged) app.setAppUserModelId("com.shalemore.pupitre");
// The log and the crash dumps a report may point at, before a crash or a second instance can happen
setupDiagnostics();

if (!app.requestSingleInstanceLock({ file: launchFileFromArgv() })) {
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
