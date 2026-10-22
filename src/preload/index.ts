import { contextBridge, ipcRenderer, webUtils } from "electron";
import {
  type DesktopApi,
  INITIAL_STATE_SYNC,
  type InitialState,
  type RendererEvents,
} from "@shared/desktop-api";

// Fetched synchronously so the first paint already uses the right language and colors; later
// changes arrive as events
const initialState: InitialState = ipcRenderer.sendSync(INITIAL_STATE_SYNC);

const platform =
  process.platform === "darwin" || process.platform === "win32" ? process.platform : "linux";

const api: DesktopApi = {
  platform,
  versions: { electron: process.versions.electron, chrome: process.versions.chrome },
  initialState,
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: RendererEvents[typeof channel]) =>
      listener(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.off(channel, handler);
  },
  getPathForFile: (file) => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld("desktop", api);
