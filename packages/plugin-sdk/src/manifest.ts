import { z } from "zod";
import { localizedTextSchema } from "./localized";
import { permissionSchema } from "./permissions";

/** A folder name: lowercase letters, digits, dots and hyphens, starting and ending with one. */
const ID = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

/** The id of a plugin, which also names its folder under `plugins/`. */
export const pluginIdSchema = z
  .string()
  .regex(ID, "must be lowercase letters, digits, dots or hyphens");
/** A version of the plugin itself, with the prerelease and build parts semantic versioning adds. */
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * The two visual surfaces a plugin may provide a module for. The host creates the page and the
 * canvas; the module only draws on them.
 */
export const pluginSurfacesSchema = z.object({
  background: z.string().min(1).optional(),
  pointer: z.string().min(1).optional(),
});

export const pluginManifestSchema = z.object({
  /** Names the plugin and its folder; never changes when the plugin updates. */
  id: pluginIdSchema,
  name: localizedTextSchema,
  version: z.string().regex(VERSION, "must be a semantic version"),
  description: localizedTextSchema.optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  homepage: z.url().optional(),
  /** The Pupitre versions the plugin supports, as a semver range. */
  engines: z.object({ pupitre: z.string().min(1) }).optional(),
  /** The module the host runs for the plugin itself, beside the manifest. */
  main: z.string().min(1).optional(),
  /** A stylesheet the host injects as the `plugin` cascade layer. */
  styles: z.string().min(1).optional(),
  /** The module of each visual surface, beside the manifest. */
  surfaces: pluginSurfacesSchema.optional(),
  permissions: z.array(permissionSchema).default([]),
});

export type PluginManifest = z.output<typeof pluginManifestSchema>;
/** What a manifest file may leave out; the defaults fill it in when it is parsed. */
export type PluginManifestInput = z.input<typeof pluginManifestSchema>;

/**
 * Names a manifest without a cast. The host validates the file with `pluginManifestSchema`
 * before it uses anything in it.
 */
export function defineManifest(manifest: PluginManifestInput): PluginManifestInput {
  return manifest;
}

export function parseManifest(value: unknown): PluginManifest {
  return pluginManifestSchema.parse(value);
}
