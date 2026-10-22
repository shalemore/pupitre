import { z } from "zod";
import { LOCALE_CODES } from "./i18n/types";

/**
 * The settings file may be hand-edited and corrupted, so every field falls back to its default with `.catch`,
 * One invalid field does not invalidate the whole file.
 */
export const settingsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).catch("system"),
  locale: z.enum(["auto", ...LOCALE_CODES]).catch("auto"),
  fontSize: z.number().min(10).max(32).catch(15),
  lineHeight: z.number().min(1).max(3).catch(1.75),
  fontFamily: z.string().catch("sans"),
  fallbackFont: z.string().catch(""),
  editorWidth: z.enum(["compact", "normal", "wide", "full"]).catch("normal"),
  sidebarVisible: z.boolean().catch(true),
  autoSave: z.boolean().catch(false),
  animations: z.enum(["system", "on", "off"]).catch("system"),
  recentFiles: z.array(z.string()).catch([]),
});

export type Settings = z.infer<typeof settingsSchema>;
export type EditorWidth = Settings["editorWidth"];
export type AnimationSetting = Settings["animations"];

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});
