import { z } from "zod";

/**
 * The settings a plugin reads. The host validates the stored values with the same schema, so a
 * value the plugin receives always has the shape it declared, and builds the settings form from
 * the schema the plugin exposes to it.
 */
export type PluginSettings = z.ZodObject<z.ZodRawShape>;

/** Declares a plugin's settings, keeping the inferred type for `activate`. */
export function defineSettings<const T extends z.ZodRawShape>(shape: T): z.ZodObject<T> {
  return z.object(shape);
}
