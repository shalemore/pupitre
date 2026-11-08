import { join } from "node:path";
import type { PluginManifest } from "@pupitre/plugin-sdk";
import { BrowserWindow, session, type WebContents } from "electron";
import log from "electron-log/main";
import { handlePluginProtocolForSession } from "./protocol";

const hosts = new Map<string, BrowserWindow>();
/** Which plugin a webContents belongs to; the RPC handler trusts nothing else. */
const plugins = new Map<number, string>();
const protocolSessions = new Set<string>();

/** The hidden window hosting one plugin, while it runs. */
export function pluginIdForSender(webContents: WebContents): string | undefined {
  return plugins.get(webContents.id);
}

function hostUrl(id: string, main: string): string {
  const query = `?id=${encodeURIComponent(id)}&main=${encodeURIComponent(main)}`;
  // During development the renderer lives on Vite's server; the built app serves the same page
  // through the plugin protocol
  const dev = process.env["ELECTRON_RENDERER_URL"];
  return dev === undefined
    ? `pupitre-plugin://${id}/__host__/index.html${query}`
    : `${dev}/plugin-host/index.html${query}`;
}

/**
 * Starts the page that runs one plugin's code: a hidden window with no Node, its own in-memory
 * session and a preload that exposes nothing but the RPC bridge.
 */
export async function startPlugin(id: string, manifest: PluginManifest): Promise<void> {
  if (manifest.main === undefined || hosts.has(id)) return;
  const partition = `plugin:${id}`;
  const pluginSession = session.fromPartition(partition);
  pluginSession.setPermissionCheckHandler(() => false);
  pluginSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  );
  // A custom protocol handler belongs to a session, and this one is not the default
  if (!protocolSessions.has(partition)) {
    handlePluginProtocolForSession(pluginSession);
    protocolSessions.add(partition);
  }

  const window = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      devTools: false,
      // The page is never shown, so the timers a plugin starts must still run
      backgroundThrottling: false,
      partition,
      preload: join(import.meta.dirname, "../preload/plugin.cjs"),
    },
  });
  const webContentsId = window.webContents.id;
  hosts.set(id, window);
  plugins.set(webContentsId, id);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on("will-redirect", (event) => event.preventDefault());
  window.webContents.on("render-process-gone", (_event, details) => {
    log.error(`The plugin ${id} stopped: ${details.reason}`);
    stopPlugin(id);
  });
  window.on("closed", () => {
    plugins.delete(webContentsId);
    hosts.delete(id);
  });

  try {
    await window.loadURL(hostUrl(id, manifest.main));
  } catch (error: unknown) {
    log.error(`The plugin ${id} could not start`, error);
    stopPlugin(id);
  }
}

/** The window of a running plugin, so the main process can send it its settings. */
export function pluginWindow(id: string): BrowserWindow | undefined {
  return hosts.get(id);
}

export function stopPlugin(id: string): void {
  const window = hosts.get(id);
  if (window === undefined) return;
  hosts.delete(id);
  plugins.delete(window.webContents.id);
  if (!window.isDestroyed()) window.destroy();
}

/** Closes every plugin page, so the app can quit without them holding the process open. */
export function stopAllPlugins(): void {
  for (const id of hosts.keys()) stopPlugin(id);
}
