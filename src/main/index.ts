import { app, BrowserWindow, nativeTheme, session } from "electron";
import { registerIpcHandlers } from "./ipc";
import { setupApplicationMenu } from "./menu";
import { getSettings, onSettingsChange } from "./settings-store";
import { setupUpdater } from "./updater";
import { createMainWindow, getMainWindow, syncWindowColors } from "./windows";

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const window = getMainWindow();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  void app.whenReady().then(() => {
    nativeTheme.themeSource = getSettings().theme;
    nativeTheme.on("updated", syncWindowColors);

    // The font picker reads system fonts through queryLocalFonts, which needs the local-fonts permission
    session.defaultSession.setPermissionCheckHandler(
      (_webContents, permission) => permission === "local-fonts",
    );
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) =>
      callback(permission === "local-fonts"),
    );

    registerIpcHandlers();
    setupUpdater();
    setupApplicationMenu();
    onSettingsChange(setupApplicationMenu);
    createMainWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("window-all-closed", () => app.quit());
}
