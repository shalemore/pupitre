import { z } from "zod";
import { LOCALE_CODES } from "./i18n/types";

/**
 * The single definition of every setting and its default. The settings file only stores values
 * the user changed; a missing or invalid value falls back to its own default through `.catch`, so
 * one bad entry never discards the rest of the file. Unknown keys are ignored.
 */
export const settingsSchema = z.object({
  // General
  locale: z.enum(["auto", ...LOCALE_CODES]).catch("auto"),
  startup: z.enum(["welcome", "last-file", "new-file"]).catch("welcome"),
  autoSave: z.boolean().catch(false),
  autoCheckUpdates: z.boolean().catch(true),

  // Appearance
  colorScheme: z.enum(["system", "light", "dark"]).catch("system"),
  /** Theme folder name, see src/renderer/themes. */
  theme: z.string().min(1).catch("pupitre"),
  /** Theme used while the dark color scheme is active; empty means the same as `theme`. */
  darkTheme: z.string().catch(""),
  /** Font of menus, sidebar and dialogs; empty means the platform's interface font. */
  uiFont: z.string().catch(""),
  animations: z.enum(["system", "on", "off"]).catch("system"),
  /** Read when a window is created, so a change applies to windows opened afterwards. */
  windowStyle: z.enum(["classic", "immersive"]).catch("classic"),
  sidebarVisible: z.boolean().catch(true),
  showWordCount: z.boolean().catch(true),
  focusMode: z.boolean().catch(false),
  typewriterMode: z.boolean().catch(false),

  // Editor; an empty font name means "use the theme's font"
  bodyFont: z.string().catch(""),
  fallbackFont: z.string().catch(""),
  codeFont: z.string().catch(""),
  fontSize: z.number().min(10).max(32).catch(16),
  lineHeight: z.number().min(1).max(3).catch(1.75),
  contentWidth: z.enum(["compact", "normal", "wide", "full"]).catch("normal"),
  spellcheck: z.boolean().catch(true),

  // How Markdown is written, matching the remark-stringify options of the same meaning
  bulletMarker: z.enum(["-", "*", "+"]).catch("-"),
  emphasisMarker: z.enum(["*", "_"]).catch("*"),
  strongMarker: z.enum(["*", "_"]).catch("*"),
  fenceMarker: z.enum(["`", "~"]).catch("`"),
  ruleMarker: z.enum(["-", "*", "_"]).catch("-"),
  incrementListMarker: z.boolean().catch(true),
  lineEnding: z.enum(["auto", "lf", "crlf"]).catch("auto"),
  imageFolder: z.string().min(1).catch("assets"),
});

export type Settings = z.output<typeof settingsSchema>;
export type SettingKey = keyof Settings;
export type ContentWidth = Settings["contentWidth"];

export const SETTING_KEYS = settingsSchema.keyof().options;
export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

/** Reads a parsed settings file; anything that is not an object counts as "nothing changed". */
export function resolveSettings(file: unknown): Settings {
  return settingsSchema.catch(DEFAULT_SETTINGS).parse(file);
}

export function isModified(settings: Settings, key: SettingKey): boolean {
  return !Object.is(settings[key], DEFAULT_SETTINGS[key]);
}
