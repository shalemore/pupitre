import { join } from "node:path";
import { app, BrowserWindow, nativeTheme, session } from "electron";
import { registerIpcHandlers } from "./ipc";
import { allowMacTypeInjection } from "./mactype";
import { rebuildApplicationMenu } from "./menu";
import { handleOpenFileRequests } from "./open-files";
import { onRecentFilesChange } from "./recent-files";
import { getSettings, onSettingsChange } from "./settings-store";
import { checkForUpdatesOnStartup, setupUpdater } from "./updater";
import { createMainWindow } from "./windows";

allowMacTypeInjection();
// Groups the taskbar button and attributes notifications to the app; electron-builder uses the same id
app.setAppUserModelId("com.shalemore.pupitre");

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
    setupUpdater();
    rebuildApplicationMenu();
    onSettingsChange(rebuildApplicationMenu);
    onRecentFilesChange(rebuildApplicationMenu);
    createMainWindow();
    checkForUpdatesOnStartup();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("window-all-closed", () => app.quit());
}
