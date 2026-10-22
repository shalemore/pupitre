import { join } from "node:path";
import {
  app,
  BrowserWindow,
  type BrowserWindowConstructorOptions,
  nativeTheme,
  shell,
} from "electron";
import type { AppCommand, WindowColors } from "@shared/desktop-api";
import { setupContextMenu } from "./context-menu";

/** The renderer picks the view to show from location.hash. */
type View = "main" | "settings";

const TITLE_BAR_HEIGHT = 40;

let mainWindow: BrowserWindow | undefined;
// Windows with unsaved changes; the renderer must ask about saving before they close
const editedWindows = new WeakSet<BrowserWindow>();
let settingsWindow: BrowserWindow | undefined;

// Before a window shows there is no page yet, so it uses the colors a theme reported earlier; the first launch uses the default theme's values
const knownColors = {
  light: { background: "#fcfcfc", symbol: "#525252" },
  dark: { background: "#131313", symbol: "#a4a4a4" },
};

function windowColors() {
  return nativeTheme.shouldUseDarkColors ? knownColors.dark : knownColors.light;
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
      spellcheck: true,
    },
  });

  const { webContents } = window;
  window.once("ready-to-show", () => window.show());
  setupContextMenu(webContents, { formatting: view === "main" });
  webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  // Windows only show the app's own page; a dropped file or a clicked link must never navigate it away
  webContents.on("will-navigate", (event) => event.preventDefault());
  // Electron does not handle Ctrl+wheel zoom by itself; use the same step as the menu
  webContents.on("zoom-changed", (_event, direction) => {
    webContents.setZoomLevel(webContents.getZoomLevel() + (direction === "in" ? 0.5 : -0.5));
  });

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
  const window = mainWindow;
  window.on("close", (event) => {
    if (!editedWindows.has(window)) return;
    event.preventDefault();
    dispatchToMainWindow({ id: "window.close" });
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

export function setDocumentEdited(window: BrowserWindow, edited: boolean): void {
  if (edited) editedWindows.add(window);
  else editedWindows.delete(window);
  // macOS shows a dot on the close button
  window.setDocumentEdited(edited);
}

export function closeWithoutPrompt(window: BrowserWindow): void {
  editedWindows.delete(window);
  window.close();
}

/** Hands a command to the main window and brings it to the front. */
export function dispatchToMainWindow(command: AppCommand): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
  mainWindow.webContents.send("app:command", command);
}

/** Colors the renderer reports after loading a theme or switching between light and dark: applied to that window and remembered for windows created later. */
export function applyWindowColors(window: BrowserWindow, colors: WindowColors): void {
  const { background, symbol } = colors;
  knownColors[colors.dark ? "dark" : "light"] = { background, symbol };
  window.setBackgroundColor(background);
  if (process.platform !== "darwin") {
    window.setTitleBarOverlay({
      color: "#00000000",
      symbolColor: symbol,
      height: TITLE_BAR_HEIGHT,
    });
  }
}
