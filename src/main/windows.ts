import { join } from "node:path";
import {
  app,
  BrowserWindow,
  type BrowserWindowConstructorOptions,
  nativeTheme,
  shell,
} from "electron";
import type { AppCommand } from "@shared/desktop-api";

/** The renderer picks the view to show from location.hash. */
type View = "main" | "settings";

const TITLE_BAR_HEIGHT = 40;

let mainWindow: BrowserWindow | undefined;
let settingsWindow: BrowserWindow | undefined;

// Matches the light and dark values of --ui-surface-1 / --ui-text-secondary in app.css, avoiding a background flash before the window shows
function windowColors() {
  return nativeTheme.shouldUseDarkColors
    ? { background: "#131313", symbol: "#a4a4a4" }
    : { background: "#fcfcfc", symbol: "#525252" };
}

function titleBarOptions(): BrowserWindowConstructorOptions {
  if (process.platform === "darwin") {
    // The traffic lights are centered vertically in the 40px title bar
    return { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 14, y: 14 } };
  }
  return {
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#00000000",
      symbolColor: windowColors().symbol,
      height: TITLE_BAR_HEIGHT,
    },
  };
}

function createWindow(view: View, options: BrowserWindowConstructorOptions): BrowserWindow {
  const window = new BrowserWindow({
    show: false,
    backgroundColor: windowColors().background,
    ...titleBarOptions(),
    ...options,
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.cjs"),
      sandbox: true,
      contextIsolation: true,
      spellcheck: false,
    },
  });

  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  if (!app.isPackaged) {
    window.webContents.on("before-input-event", (_event, input) => {
      if (input.type === "keyDown" && input.key === "F12") window.webContents.toggleDevTools();
    });
  }

  const hash = view === "main" ? "" : view;
  const devServerUrl = process.env["ELECTRON_RENDERER_URL"];
  if (!app.isPackaged && devServerUrl) {
    void window.loadURL(`${devServerUrl}#${hash}`);
  } else {
    void window.loadFile(join(import.meta.dirname, "../renderer/index.html"), { hash });
  }
  return window;
}

export function createMainWindow(): BrowserWindow {
  mainWindow = createWindow("main", {
    width: 1180,
    height: 780,
    minWidth: 720,
    minHeight: 480,
    title: "Pupitre",
  });
  mainWindow.on("closed", () => {
    mainWindow = undefined;
    settingsWindow?.close();
  });
  return mainWindow;
}

export function showSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = createWindow("settings", {
    width: 720,
    height: 560,
    minWidth: 540,
    minHeight: 440,
    minimizable: false,
    maximizable: false,
  });
  settingsWindow.on("closed", () => {
    settingsWindow = undefined;
  });
}

export function getMainWindow(): BrowserWindow | undefined {
  return mainWindow;
}

/** Hands a command to the main window and brings it to the front. */
export function dispatchToMainWindow(command: AppCommand): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
  mainWindow.webContents.send("app:command", command);
}

/** Keeps the window background and the Windows title bar button colors in sync when the system or the user switches between light and dark. */
export function syncWindowColors(): void {
  const colors = windowColors();
  for (const window of BrowserWindow.getAllWindows()) {
    window.setBackgroundColor(colors.background);
    if (process.platform !== "darwin") {
      window.setTitleBarOverlay({
        color: "#00000000",
        symbolColor: colors.symbol,
        height: TITLE_BAR_HEIGHT,
      });
    }
  }
}
