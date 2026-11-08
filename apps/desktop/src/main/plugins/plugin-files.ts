import { randomUUID } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import type { PluginInfo } from "@pupitre/desktop-api";
import {
  type Permission,
  type PluginManifest,
  permissionSchema,
  parseManifest,
  pluginIdSchema,
} from "@pupitre/plugin-sdk";
import { z } from "zod";
import { isInside } from "../is-inside";
import { readJsonFile, writeJsonFile } from "../json-file";

/** The file a plugin's manifest sits in, and the file the host keeps its state in. */
export const MANIFEST_FILE = "manifest.json";
const STATE_FILE = "state.json";

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
  return { id, manifest, enabled: state.enabled, granted: state.granted };
}

/** A symbolic link could point anywhere, so a plugin folder may not hold one. */
function assertPlainTree(folder: string): void {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error("A plugin may not contain symbolic links");
    if (entry.isDirectory()) assertPlainTree(join(folder, entry.name));
  }
}

/** Copies the plugin at `source` into `root`, where it starts disabled and ungranted. */
export function installCopy(source: string, root: string): PluginInfo {
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

/** Removes an installed plugin, whatever state it was left in. */
export function removePlugin(root: string, id: string): void {
  pluginIdSchema.parse(id);
  rmSync(join(root, id), { recursive: true, force: true });
}
