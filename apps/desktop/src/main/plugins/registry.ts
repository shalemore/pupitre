import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { PluginInfo } from "@pupitre/desktop-api";
import { pluginIdSchema, type Permission, type PluginManifest } from "@pupitre/plugin-sdk";
import { dialog, shell, type BrowserWindow } from "electron";
import log from "electron-log/main";
import { broadcast } from "../broadcast";
import { pluginWindow, startPlugin, stopPlugin } from "./host";
import { pluginsFolder } from "./paths";
import {
  installCopy,
  MANIFEST_FILE,
  readCommands,
  readPlugin,
  readSettingsMeta,
  readState,
  writeSettingsValues,
  writeState,
} from "./plugin-files";

/** What a plugin's settings may weigh, so the file stays a preference, not a database. */
const MAX_SETTINGS_BYTES = 64 * 1024;

/** The plugins installed under the user's data folder, sorted by id. */
export function listPlugins(): readonly PluginInfo[] {
  const root = pluginsFolder();
  if (!existsSync(root)) return [];
  const plugins: PluginInfo[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const plugin = readPlugin(join(root, entry.name));
    if (plugin === undefined) {
      log.warn(`Skipped the plugin folder ${entry.name}`);
      continue;
    }
    plugins.push(plugin);
  }
  return plugins.toSorted((a, b) => a.id.localeCompare(b.id));
}

function publish(): readonly PluginInfo[] {
  const plugins = listPlugins();
  broadcast("plugins:changed", plugins);
  return plugins;
}

/** The installed plugin, its folder and manifest, or an error for a plugin that is not there. */
function installed(id: string): { folder: string; manifest: PluginManifest } {
  const pluginId = pluginIdSchema.parse(id);
  const folder = join(pluginsFolder(), pluginId);
  const plugin = readPlugin(folder);
  if (plugin === undefined) throw new Error(`The plugin ${pluginId} is not installed`);
  return { folder, manifest: plugin.manifest };
}

/** A plugin runs only while every permission it asks for was granted for this version. */
function requireGrants(manifest: PluginManifest, granted: readonly Permission[]): void {
  const missing = manifest.permissions.filter((permission) => !granted.includes(permission));
  if (missing.length > 0) {
    throw new Error(`The plugin needs permissions that were not granted: ${missing.join(", ")}`);
  }
}

/** Asks for a plugin folder, copies it into place and tells every window. */
export async function installPlugin(window: BrowserWindow): Promise<PluginInfo | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    properties: ["openDirectory"],
  });
  const [source] = filePaths;
  if (canceled || source === undefined) return null;
  const plugin = installCopy(source, pluginsFolder());
  publish();
  return plugin;
}

export function setPluginEnabled(id: string, enabled: boolean): void {
  const { folder, manifest } = installed(id);
  const state = readState(folder, manifest);
  if (enabled) requireGrants(manifest, state.granted);
  writeState(folder, { ...state, enabled, version: manifest.version });
  if (enabled) void startPlugin(id, manifest);
  else stopPlugin(id);
  publish();
}

/** Keeps only what the manifest asks for; a plugin missing a grant stops running. */
export function grantPluginPermissions(id: string, permissions: readonly Permission[]): void {
  const { folder, manifest } = installed(id);
  const state = readState(folder, manifest);
  const granted = manifest.permissions.filter((permission) => permissions.includes(permission));
  const complete = granted.length === manifest.permissions.length;
  writeState(folder, {
    enabled: complete && state.enabled,
    version: manifest.version,
    granted,
  });
  if (!complete) stopPlugin(id);
  publish();
}

/** The folder goes to the system trash, so a plugin removed by mistake can be put back. */
export async function uninstallPlugin(id: string): Promise<void> {
  pluginIdSchema.parse(id);
  stopPlugin(id);
  await shell.trashItem(join(pluginsFolder(), id));
  publish();
}

export function revealPlugin(id: string): void {
  const { folder } = installed(id);
  shell.showItemInFolder(join(folder, MANIFEST_FILE));
}

/** Asks the plugin page to run a command the palette is showing. */
export function runPluginCommand(id: string, commandId: string): void {
  const { folder } = installed(id);
  const commands = readCommands(folder);
  if (commands === undefined || !commands.some((command) => command.id === commandId)) {
    throw new Error(`The plugin has no command ${commandId}`);
  }
  const window = pluginWindow(id);
  if (window === undefined) throw new Error("The plugin is not running");
  window.webContents.send("plugin:command", commandId);
}

/** The form the settings window drew sends the whole set of values back. */
export function updatePluginSettings(id: string, values: Readonly<Record<string, unknown>>): void {
  const { folder } = installed(id);
  if (readSettingsMeta(folder) === undefined) throw new Error("The plugin declares no settings");
  const text = JSON.stringify(values);
  if (text === undefined || Buffer.byteLength(text, "utf8") > MAX_SETTINGS_BYTES) {
    throw new Error("The plugin settings are too large");
  }
  const copy: Record<string, unknown> = { ...values };
  writeSettingsValues(folder, copy);
  // The plugin page listens through the preload bridge; the values are already its own
  pluginWindow(id)?.webContents.send("plugin:settings", copy);
  publish();
}
