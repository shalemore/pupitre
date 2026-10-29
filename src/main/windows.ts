import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {
  app,
  BrowserWindow,
  type BrowserWindowConstructorOptions,
  nativeTheme,
  screen,
  shell,
  type WebContents,
} from "electron";
import {
  TITLE_BAR_HEIGHT,
  type AppCommand,
  type CaptionSide,
  type WindowColors,
} from "@shared/desktop-api";
import { setupContextMenu } from "./context-menu";
import { onSettingsChange } from "./settings-store";
import {
  flushWindowState,
  readWindowState,
  updateWindowState,
  type WindowBounds,
} from "./window-state";
import { applyZoom, stepZoom } from "./zoom";

/** The renderer picks the view to show from location.hash. */
type View = "main" | "settings";

let mainWindow: BrowserWindow | undefined;
// Windows with unsaved changes; the renderer must ask about saving before they close
const editedWindows = new WeakSet<BrowserWindow>();
let settingsWindow: BrowserWindow | undefined;

/** The size the main window opens at when nothing is remembered. */
const MAIN_WINDOW_SIZE = { width: 1180, height: 780 };
/** The smallest the main window may be made, which it has to fit on the display it opens on. */
const MAIN_WINDOW_MIN_SIZE = { width: 720, height: 480 };

// Before a window shows there is no page yet, so it uses the colors a theme reported earlier; the first launch uses the default theme's values
const knownColors = {
  light: { background: "#fcfcfc", symbol: "#525252" },
  dark: { background: "#131313", symbol: "#a4a4a4" },
};

function windowColors() {
  return nativeTheme.shouldUseDarkColors ? knownColors.dark : knownColors.light;
}

/**
 * GNOME and other Linux desktops can put the caption buttons on the left. The layout lists the
 * buttons left and right of a colon, e.g. "close,minimize,maximize:appmenu".
 */
function linuxCaptionSide(): "left" | "right" {
  try {
    const layout = execFileSync(
      "gsettings",
      ["get", "org.gnome.desktop.wm.preferences", "button-layout"],
      { encoding: "utf8", timeout: 1000 },
    );
    const [left = ""] = layout.replaceAll("'", "").split(":");
    return left.includes("close") ? "left" : "right";
  } catch {
    return "right";
  }
}

/**
 * The main window draws its caption buttons itself (Windows and Linux): the native ones could not
 * hide with the title bar, and the frame must not depend on the window style so that the style can
 * change while the window is open.
 */
export function getCaptionSide(webContents: WebContents): CaptionSide | undefined {
  if (process.platform === "darwin" || webContents !== mainWindow?.webContents) return undefined;
  return process.platform === "linux" ? linuxCaptionSide() : "right";
}

function titleBarOptions(view: View): BrowserWindowConstructorOptions {
  if (process.platform === "darwin") {
    // The traffic lights are centered in the 40px title bar
    return { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 14, y: 14 } };
  }
  if (view === "main") return { titleBarStyle: "hidden" };
  return {
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#00000000",
      symbolColor: windowColors().symbol,
      height: TITLE_BAR_HEIGHT,
    },
  };
}

/**
 * Packaged builds take the icon from the executable. An unpackaged run uses electron's own
 * executable, so the windows (and the Windows taskbar) are given the app icon explicitly.
 */
function developmentIcon(): Pick<BrowserWindowConstructorOptions, "icon"> {
  if (app.isPackaged) return {};
  return {
    icon: join(
      app.getAppPath(),
      process.platform === "win32" ? "build/icon.ico" : "build/icon.png",
    ),
  };
}

function createWindow(view: View, options: BrowserWindowConstructorOptions): BrowserWindow {
  const window = new BrowserWindow({
    show: false,
    backgroundColor: windowColors().background,
    ...titleBarOptions(view),
    ...developmentIcon(),
    ...options,
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.cjs"),
      sandbox: true,
      contextIsolation: true,
      spellcheck: true,
      // The zoom setting belongs to the document window, which applies it itself; an automatic mode
      // would zoom every window of the same origin together, settings included
      zoomMode: view === "main" ? "manual" : "disabled",
      // The dev server page is http://, which Chromium forbids to load the file:// images that sit
      // next to a document. The packaged app loads from file:// and keeps the protection.
      webSecurity: app.isPackaged,
    },
  });

  const { webContents } = window;
  window.once("ready-to-show", () => window.show());
  window.on("maximize", () => webContents.send("window:maximized-changed", true));
  window.on("unmaximize", () => webContents.send("window:maximized-changed", false));
  setupContextMenu(webContents, { formatting: view === "main" });
  webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  // Windows only show the app's own page; a dropped file or a clicked link must never navigate it away
  webContents.on("will-navigate", (event) => event.preventDefault());
  if (view === "main") {
    // Electron does not handle Ctrl+wheel zoom by itself; it steps the setting like the menu does
    webContents.on("zoom-changed", (_event, direction) => stepZoom(direction));
    webContents.on("did-finish-load", () => applyZoom(webContents));
    const unsubscribe = onSettingsChange(() => applyZoom(webContents));
    window.on("closed", unsubscribe);
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Moves a window placed by saved bounds back inside the work area: the size a window reports once
 * it exists is a few pixels larger than the one it was created with, which can leave an edge of it
 * past the screen.
 */
function fitOnScreen(window: BrowserWindow): void {
  const bounds = window.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const rightmost = Math.max(area.x, area.x + area.width - bounds.width);
  const lowest = Math.max(area.y, area.y + area.height - bounds.height);
  const x = clamp(bounds.x, area.x, rightmost);
  const y = clamp(bounds.y, area.y, lowest);
  if (x !== bounds.x || y !== bounds.y) window.setPosition(x, y);
}

/**
 * Where the main window opens: the bounds it was last closed with, moved into a display that still
 * exists and shrunk to fit it. Bounds too small for the window's smallest size there open at the
 * default size, centered.
 */
function initialBounds(saved: WindowBounds | undefined): BrowserWindowConstructorOptions {
  if (saved === undefined) return MAIN_WINDOW_SIZE;
  const area = screen.getDisplayMatching(saved).workArea;
  const width = Math.min(saved.width, area.width);
  const height = Math.min(saved.height, area.height);
  if (width < MAIN_WINDOW_MIN_SIZE.width || height < MAIN_WINDOW_MIN_SIZE.height) {
    const { width: openWidth, height: openHeight } = MAIN_WINDOW_SIZE;
    return {
      width: openWidth,
      height: openHeight,
      x: Math.round(area.x + (area.width - openWidth) / 2),
      y: Math.round(area.y + (area.height - openHeight) / 2),
    };
  }
  return {
    width,
    height,
    x: clamp(saved.x, area.x, area.x + area.width - width),
    y: clamp(saved.y, area.y, area.y + area.height - height),
  };
}

export function createMainWindow(): BrowserWindow {
  const saved = readWindowState();
  mainWindow = createWindow("main", {
    ...initialBounds(saved?.bounds),
    minWidth: MAIN_WINDOW_MIN_SIZE.width,
    minHeight: MAIN_WINDOW_MIN_SIZE.height,
    title: "Pupitre",
  });
  const window = mainWindow;
  // Restoring these before the window is on screen does not stick on every platform, so the state
  // it was closed in comes back once it shows
  window.once("ready-to-show", () => {
    fitOnScreen(window);
    if (saved?.maximized === true) window.maximize();
    if (saved?.fullscreen === true) window.setFullScreen(true);
  });
  const rememberState = () => {
    updateWindowState({
      bounds: window.getNormalBounds(),
      maximized: window.isMaximized(),
      fullscreen: window.isFullScreen(),
    });
  };
  window.on("move", rememberState);
  window.on("resize", rememberState);
  window.on("maximize", rememberState);
  window.on("unmaximize", rememberState);
  window.on("enter-full-screen", rememberState);
  window.on("leave-full-screen", rememberState);
  window.on("close", () => {
    rememberState();
    flushWindowState();
  });
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
  if (process.platform !== "darwin" && !getCaptionSide(window.webContents)) {
    window.setTitleBarOverlay({
      color: "#00000000",
      symbolColor: symbol,
      height: TITLE_BAR_HEIGHT,
    });
  }
}
