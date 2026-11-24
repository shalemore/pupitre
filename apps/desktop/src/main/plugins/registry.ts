import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { PluginInfo, PluginStyle } from "@pupitre/desktop-api";
import { pluginIdSchema, type Permission, type PluginManifest } from "@pupitre/plugin-sdk";
import { app, dialog, shell, type BrowserWindow } from "electron";
import log from "electron-log/main";
import { broadcast } from "../broadcast";
import { getWorkspaceState } from "../settings/settings-store";
import { pluginWindow, startPlugin, stopPlugin, stopPluginAndWait } from "./host";
import { pluginsFolder } from "./paths";
import {
  installCopy,
  MANIFEST_FILE,
  readCommands,
  readEffectiveSettingsValues,
  readPlugin,
  readSettingsMeta,
  readState,
  satisfiesPupitreEngine,
  writeSettingsValues,
  writeState,
  writeWorkspaceSettingsValues,
} from "./plugin-files";
import { readPluginStyle } from "./styles";

/** What a plugin's settings may weigh, so the file stays a preference, not a database. */
const MAX_SETTINGS_BYTES = 64 * 1024;

interface InstalledPlugin {
  folder: string;
  info: PluginInfo;
}

/** Every plugin folder under the user's data folder that reads, sorted by id. */
function installedPlugins(): InstalledPlugin[] {
  const root = pluginsFolder();
  if (!existsSync(root)) return [];
  const plugins: InstalledPlugin[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folder = join(root, entry.name);
    const info = readPlugin(folder);
    if (info === undefined) {
      log.warn(`Skipped the plugin folder ${entry.name}`);
      continue;
    }
    plugins.push({ folder, info });
  }
  return plugins.toSorted((a, b) => a.info.id.localeCompare(b.info.id));
}

export function activePluginWorkspaceRoot(): string | undefined {
  const ws = getWorkspaceState();
  return ws.active && ws.root !== null ? ws.root : undefined;
}

/** The plugins installed under the user's data folder, sorted by id. */
export function listPlugins(): readonly PluginInfo[] {
  const workspaceRoot = activePluginWorkspaceRoot();
  return installedPlugins().map(({ folder, info }) => {
    if (info.settings === undefined || workspaceRoot === undefined) return info;
    return {
      ...info,
      settings: {
        ...info.settings,
        values: readEffectiveSettingsValues(folder, info.id, workspaceRoot),
      },
    };
  });
}

/** The stylesheets of the running plugins that were granted `ui:styles`. */
export function pluginStyles(): readonly PluginStyle[] {
  const styles: PluginStyle[] = [];
  for (const { folder, info } of installedPlugins()) {
    if (!info.enabled || info.manifest.styles === undefined) continue;
    if (!info.granted.includes("ui:styles")) continue;
    const css = readPluginStyle(folder, info.manifest.styles);
    if (css !== undefined) styles.push({ id: info.id, css });
  }
  return styles;
}

export function publishPlugins(): void {
  broadcast("plugins:changed", listPlugins());
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
  const plugin = installCopy(source, pluginsFolder(), app.getVersion());
  publishPlugins();
  return plugin;
}

export function disableFailedPlugin(id: string): void {
  const folder = join(pluginsFolder(), id);
  const plugin = readPlugin(folder);
  if (plugin !== undefined) {
    const state = readState(folder, plugin.manifest);
    if (state.enabled) writeState(folder, { ...state, enabled: false });
  }
  stopPlugin(id);
  publishPlugins();
}

export function startEnabledPlugin(id: string, manifest: PluginManifest): void {
  if (
    manifest.engines?.pupitre !== undefined &&
    !satisfiesPupitreEngine(app.getVersion(), manifest.engines.pupitre)
  ) {
    log.warn(
      `Skipped plugin ${id}: requires Pupitre ${manifest.engines.pupitre} (running ${app.getVersion()})`,
    );
    disableFailedPlugin(id);
    return;
  }
  void startPlugin(id, manifest, disableFailedPlugin);
}

export function setPluginEnabled(id: string, enabled: boolean): void {
  const { folder, manifest } = installed(id);
  const state = readState(folder, manifest);
  if (enabled) {
    requireGrants(manifest, state.granted);
    if (
      manifest.engines?.pupitre !== undefined &&
      !satisfiesPupitreEngine(app.getVersion(), manifest.engines.pupitre)
    ) {
      throw new Error(
        `The plugin requires Pupitre ${manifest.engines.pupitre} (running ${app.getVersion()})`,
      );
    }
  }
  writeState(folder, { ...state, enabled, version: manifest.version });
  if (enabled) startEnabledPlugin(id, manifest);
  else stopPlugin(id);
  publishPlugins();
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
  publishPlugins();
}

/** The folder goes to the system trash, so a plugin removed by mistake can be put back. */
export async function uninstallPlugin(id: string): Promise<void> {
  pluginIdSchema.parse(id);
  await stopPluginAndWait(id);
  await shell.trashItem(join(pluginsFolder(), id));
  publishPlugins();
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateSchemaField(key: string, field: Record<string, unknown>, value: unknown): void {
  const type = field["type"];
  if (type === "boolean" && typeof value !== "boolean") {
    throw new Error(`Plugin setting "${key}" must be a boolean`);
  }
  if (type === "number" || type === "integer") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`Plugin setting "${key}" must be a number`);
    }
    if (type === "integer" && !Number.isInteger(value)) {
      throw new Error(`Plugin setting "${key}" must be an integer`);
    }
    if (typeof field["minimum"] === "number" && value < field["minimum"]) {
      throw new Error(`Plugin setting "${key}" must be >= ${field["minimum"]}`);
    }
    if (typeof field["maximum"] === "number" && value > field["maximum"]) {
      throw new Error(`Plugin setting "${key}" must be <= ${field["maximum"]}`);
    }
  }
  if (type === "string") {
    if (typeof value !== "string") {
      throw new Error(`Plugin setting "${key}" must be a string`);
    }
    if (typeof field["minLength"] === "number" && value.length < field["minLength"]) {
      throw new Error(`Plugin setting "${key}" must have length >= ${field["minLength"]}`);
    }
    if (typeof field["maxLength"] === "number" && value.length > field["maxLength"]) {
      throw new Error(`Plugin setting "${key}" must have length <= ${field["maxLength"]}`);
    }
  }
  if (Array.isArray(field["enum"]) && !field["enum"].includes(value)) {
    throw new Error(`Plugin setting "${key}" must be one of the allowed values`);
  }
}

function validateSettingsValues(
  schema: Readonly<Record<string, unknown>>,
  values: Readonly<Record<string, unknown>>,
): void {
  const properties = isRecord(schema["properties"]) ? schema["properties"] : undefined;
  const required = Array.isArray(schema["required"]) ? schema["required"] : [];
  for (const key of required) {
    if (typeof key === "string" && values[key] === undefined) {
      throw new Error(`Missing required plugin setting "${key}"`);
    }
  }
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    const field = properties?.[key];
    if (field === undefined) {
      if (schema["additionalProperties"] === false) {
        throw new Error(`Unknown plugin setting "${key}"`);
      }
      continue;
    }
    if (isRecord(field)) validateSchemaField(key, field, value);
  }
}

/** The form the settings window drew sends the whole set of values back. */
export function updatePluginSettings(id: string, values: Readonly<Record<string, unknown>>): void {
  const { folder } = installed(id);
  const meta = readSettingsMeta(folder);
  if (meta === undefined) throw new Error("The plugin declares no settings");
  validateSettingsValues(meta.schema, values);
  const text = JSON.stringify(values);
  if (text === undefined || Buffer.byteLength(text, "utf8") > MAX_SETTINGS_BYTES) {
    throw new Error("The plugin settings are too large");
  }
  const copy: Record<string, unknown> = { ...values };
  const workspaceRoot = activePluginWorkspaceRoot();
  if (workspaceRoot !== undefined) writeWorkspaceSettingsValues(workspaceRoot, id, copy);
  else writeSettingsValues(folder, copy);
  const effective = readEffectiveSettingsValues(folder, id, workspaceRoot);
  // The plugin page listens through the preload bridge; the values are already its own
  pluginWindow(id)?.webContents.send("plugin:settings", effective);
  publishPlugins();
}

export function syncWorkspacePluginSettings(): void {
  const workspaceRoot = activePluginWorkspaceRoot();
  for (const { folder, info } of installedPlugins()) {
    if (!info.enabled || info.settings === undefined) continue;
    pluginWindow(info.id)?.webContents.send(
      "plugin:settings",
      readEffectiveSettingsValues(folder, info.id, workspaceRoot),
    );
  }
  publishPlugins();
}
