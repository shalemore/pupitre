import { z } from "zod";
import type { LocalizedText } from "./localized";

/** The words the host draws around one setting field. */
export interface PluginSettingText {
  title: LocalizedText;
  description?: LocalizedText;
}

/**
 * A plugin's settings: the schema that validates them and the text the host shows while editing
 * them. The plugin owns both, so the settings form can present a field without the app knowing
 * what the plugin is for.
 */
export interface PluginSettingsDefinition<
  S extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
> {
  schema: S;
  /** The title of the group the fields form, when the host shows one. */
  title?: LocalizedText;
  description?: LocalizedText;
  /** Titles for the fields; one without a title is labelled by its key. */
  fields?: Partial<Record<Extract<keyof z.infer<S>, string>, PluginSettingText>>;
}

/** Declares a plugin's settings, keeping the inferred value type for `activate`. */
export function defineSettings<const S extends z.ZodObject<z.ZodRawShape>>(
  definition: PluginSettingsDefinition<S>,
): PluginSettingsDefinition<S> {
  return definition;
}
