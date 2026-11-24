import { randomUUID } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import type { PluginCommandInfo, PluginInfo } from "@pupitre/desktop-api";
import {
  type Permission,
  type PluginManifest,
  localizedTextSchema,
  permissionSchema,
  parseManifest,
  pluginIdSchema,
} from "@pupitre/plugin-sdk";
import { isRecord } from "@pupitre/utils";
import { z } from "zod";
import { isInside } from "../is-inside";
import { readJsonFile, writeJsonFile } from "../json-file";

/** The file a plugin's manifest sits in, and the file the host keeps its state in. */
export const MANIFEST_FILE = "manifest.json";
const STATE_FILE = "state.json";
const SETTINGS_META_FILE = "settings.meta.json";
const SETTINGS_FILE = "settings.json";
const COMMANDS_FILE = "commands.json";

export const pluginCommandSchema = z.object({
  id: z.string().min(1).max(128),
  title: localizedTextSchema,
  shortcut: z.string().min(1).max(64).optional(),
});
const commandsSchema = z.array(pluginCommandSchema);

export const settingsMetaSchema = z.object({
  schema: z.record(z.string(), z.unknown()),
  title: localizedTextSchema.optional(),
  description: localizedTextSchema.optional(),
  fields: z
    .record(
      z.string(),
      z.object({
        title: localizedTextSchema,
        description: localizedTextSchema.optional(),
      }),
    )
    .optional(),
});

/** What a plugin declared about its settings, without the values the user chose. */
export type StoredSettingsMeta = z.infer<typeof settingsMetaSchema>;

/** What the main process remembers about a plugin between runs. */
export interface PluginState {
  enabled: boolean;
  /** The version the user granted permissions for; an update asks again. */
  version: string | undefined;
  granted: Permission[];
}

const stateSchema = z.object({
  enabled: z.boolean().default(false),
  version: z.string().optional(),
  granted: z.array(permissionSchema).default([]),
});

/** The state of an installed plugin, as fresh as a version that asks for consent again. */
export function readState(folder: string, manifest: PluginManifest): PluginState {
  const parsed = stateSchema.safeParse(readJsonFile(join(folder, STATE_FILE)));
  if (!parsed.success || parsed.data.version !== manifest.version) {
    return { enabled: false, version: manifest.version, granted: [] };
  }
  return {
    enabled: parsed.data.enabled,
    version: parsed.data.version,
    granted: parsed.data.granted,
  };
}

export function writeState(folder: string, state: PluginState): void {
  writeJsonFile(join(folder, STATE_FILE), state);
}

export function readSettingsMeta(folder: string): StoredSettingsMeta | undefined {
  const parsed = settingsMetaSchema.safeParse(readJsonFile(join(folder, SETTINGS_META_FILE)));
  return parsed.success ? parsed.data : undefined;
}

export function writeSettingsMeta(folder: string, meta: StoredSettingsMeta): void {
  writeJsonFile(join(folder, SETTINGS_META_FILE), meta);
}

export function readSettingsValues(folder: string): Record<string, unknown> {
  const value = readJsonFile(join(folder, SETTINGS_FILE));
  return isRecord(value) ? value : {};
}

export function writeSettingsValues(folder: string, values: Record<string, unknown>): void {
  writeJsonFile(join(folder, SETTINGS_FILE), values);
}

function readWorkspaceSettingsValues(workspaceRoot: string, id: string): Record<string, unknown> {
  const value = readJsonFile(join(workspaceRoot, ".pupitre", "plugins", `${id}.json`));
  return isRecord(value) ? value : {};
}

export function writeWorkspaceSettingsValues(
  workspaceRoot: string,
  id: string,
  values: Record<string, unknown>,
): void {
  writeJsonFile(join(workspaceRoot, ".pupitre", "plugins", `${id}.json`), values);
}

export function readEffectiveSettingsValues(
  folder: string,
  id: string,
  workspaceRoot: string | undefined,
): Record<string, unknown> {
  const base = readSettingsValues(folder);
  if (workspaceRoot === undefined) return base;
  return { ...base, ...readWorkspaceSettingsValues(workspaceRoot, id) };
}

export function readCommands(folder: string): PluginCommandInfo[] | undefined {
  const parsed = commandsSchema.safeParse(readJsonFile(join(folder, COMMANDS_FILE)));
  return parsed.success ? parsed.data : undefined;
}

export function writeCommands(folder: string, commands: readonly PluginCommandInfo[]): void {
  writeJsonFile(join(folder, COMMANDS_FILE), commands);
}

/** A module path a manifest declares, checked to stay inside the plugin's own folder. */
function modulePath(folder: string, relative: string): string | undefined {
  if (isAbsolute(relative)) return undefined;
  const target = resolve(folder, relative);
  return isInside(folder, target) ? target : undefined;
}

/** Why a manifest's modules cannot be used, or undefined when every one it names is usable. */
function moduleProblem(folder: string, manifest: PluginManifest): string | undefined {
  const paths: [string, string | undefined][] = [
    ["main", manifest.main],
    ["styles", manifest.styles],
    ["background", manifest.surfaces?.background],
    ["pointer", manifest.surfaces?.pointer],
  ];
  for (const [label, relative] of paths) {
    if (relative === undefined) continue;
    const target = modulePath(folder, relative);
    if (target === undefined) return `${label} must stay inside the plugin folder`;
    if (!lstatSync(target, { throwIfNoEntry: false })?.isFile()) return `${label} is missing`;
  }
  return undefined;
}

/** A plugin folder, read and checked; undefined when the folder is not a usable plugin. */
export function readPlugin(folder: string): PluginInfo | undefined {
  let id: string;
  try {
    id = pluginIdSchema.parse(basename(folder));
  } catch {
    return undefined;
  }
  let manifest: PluginManifest;
  try {
    manifest = parseManifest(readJsonFile(join(folder, MANIFEST_FILE)));
  } catch {
    return undefined;
  }
  if (manifest.id !== id || moduleProblem(folder, manifest) !== undefined) return undefined;
  const state = readState(folder, manifest);
  const info: PluginInfo = { id, manifest, enabled: state.enabled, granted: state.granted };
  const settings = readSettingsMeta(folder);
  if (settings !== undefined) {
    info.settings = { ...settings, values: readSettingsValues(folder) };
  }
  const commands = readCommands(folder);
  if (commands !== undefined) info.commands = commands;
  return info;
}

/** A symbolic link could point anywhere, so a plugin folder may not hold one. */
function assertPlainTree(folder: string): void {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error("A plugin may not contain symbolic links");
    if (entry.isDirectory()) assertPlainTree(join(folder, entry.name));
  }
}

function parseSemver(version: string): [number, number, number] | undefined {
  const clean = version.trim().split(/[-+]/, 1)[0];
  if (clean === undefined) return undefined;
  const parts = clean.split(".");
  if (parts.length !== 3) return undefined;
  const nums = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : Number.NaN));
  const [major, minor, patch] = nums;
  if (
    major === undefined ||
    minor === undefined ||
    patch === undefined ||
    !Number.isInteger(major) ||
    !Number.isInteger(minor) ||
    !Number.isInteger(patch)
  ) {
    return undefined;
  }
  return [major, minor, patch];
}

function compareSemver(a: [number, number, number], b: [number, number, number]): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

function satisfiesComparator(actual: [number, number, number], token: string): boolean {
  if (token === "*" || token === "x") return true;
  if (token.startsWith("^")) {
    const base = parseSemver(token.slice(1));
    if (base === undefined) return false;
    if (compareSemver(actual, base) < 0) return false;
    const upper: [number, number, number] =
      base[0] > 0 ? [base[0] + 1, 0, 0] : base[1] > 0 ? [0, base[1] + 1, 0] : [0, 0, base[2] + 1];
    return compareSemver(actual, upper) < 0;
  }
  if (token.startsWith("~")) {
    const base = parseSemver(token.slice(1));
    if (base === undefined) return false;
    return compareSemver(actual, base) >= 0 && compareSemver(actual, [base[0], base[1] + 1, 0]) < 0;
  }
  const match = /^(>=|<=|>|<|=)?(.*)$/.exec(token);
  if (match === null) return false;
  const target = parseSemver(match[2] ?? "");
  if (target === undefined) return false;
  const cmp = compareSemver(actual, target);
  switch (match[1]) {
    case ">=":
      return cmp >= 0;
    case "<=":
      return cmp <= 0;
    case ">":
      return cmp > 0;
    case "<":
      return cmp < 0;
    default:
      return cmp === 0;
  }
}

export function satisfiesPupitreEngine(appVersion: string, range: string): boolean {
  const actual = parseSemver(appVersion);
  if (actual === undefined) return true;
  return range.split("||").some((part) => {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => satisfiesComparator(actual, token));
  });
}

/** Copies the plugin at `source` into `root`, where it starts disabled and ungranted. */
export function installCopy(source: string, root: string, pupitreVersion?: string): PluginInfo {
  const sourceStat = lstatSync(source);
  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) {
    throw new Error("A plugin is installed from a folder");
  }
  assertPlainTree(source);
  let manifest: PluginManifest;
  try {
    manifest = parseManifest(readJsonFile(join(source, MANIFEST_FILE)));
  } catch (error: unknown) {
    throw new Error(`The plugin has no valid ${MANIFEST_FILE}`, { cause: error });
  }
  if (
    pupitreVersion !== undefined &&
    manifest.engines?.pupitre !== undefined &&
    !satisfiesPupitreEngine(pupitreVersion, manifest.engines.pupitre)
  ) {
    throw new Error(
      `The plugin requires Pupitre ${manifest.engines.pupitre} (running ${pupitreVersion})`,
    );
  }
  const problem = moduleProblem(source, manifest);
  if (problem !== undefined) throw new Error(`The plugin cannot be installed: ${problem}`);

  mkdirSync(root, { recursive: true });
  const target = join(root, manifest.id);
  if (existsSync(target)) throw new Error(`A plugin named ${manifest.id} is already installed`);

  const temporary = join(root, `.install-${randomUUID()}`);
  try {
    cpSync(source, temporary, { recursive: true, errorOnExist: true, force: false });
    // The rename makes the plugin appear whole, never half copied
    renameSync(temporary, target);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  const state: PluginState = { enabled: false, version: manifest.version, granted: [] };
  writeState(target, state);
  return { id: manifest.id, manifest, enabled: state.enabled, granted: state.granted };
}
