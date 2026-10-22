import { contextBridge, ipcRenderer, webUtils } from "electron";
import {
  type DesktopApi,
  type RendererEvents,
  SETTINGS_GET_SYNC,
  SETTINGS_PATH_SYNC,
} from "@shared/desktop-api";
import type { Settings } from "@shared/settings";

// Fetched synchronously so the first paint already uses the right language and colors; later changes arrive as events
let settings: Settings = ipcRenderer.sendSync(SETTINGS_GET_SYNC);
const settingsPath: string = ipcRenderer.sendSync(SETTINGS_PATH_SYNC);
ipcRenderer.on("settings:changed", (_event, next: Settings) => {
  settings = next;
});

const platform =
  process.platform === "darwin" || process.platform === "win32" ? process.platform : "linux";

const api: DesktopApi = {
  platform,
  versions: { electron: process.versions.electron, chrome: process.versions.chrome },
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: RendererEvents[typeof channel]) =>
      listener(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.off(channel, handler);
  },
  getSettings: () => settings,
  getSettingsPath: () => settingsPath,
  getPathForFile: (file) => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld("desktop", api);
