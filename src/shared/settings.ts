import { z } from "zod";
import { LOCALE_CODES } from "./i18n/types";

/**
 * The settings file may be hand-edited and corrupted, so every field falls back to its default with `.catch`,
 * and one invalid field does not invalidate the whole file. An empty string for fonts and the like means "follow the theme default".
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
  theme: z.string().catch("pupitre"),
  animations: z.enum(["system", "on", "off"]).catch("system"),
  sidebarVisible: z.boolean().catch(true),
  showWordCount: z.boolean().catch(true),

  // Editor
  bodyFont: z.string().catch(""),
  fallbackFont: z.string().catch(""),
  codeFont: z.string().catch(""),
  fontSize: z.number().min(10).max(32).catch(16),
  lineHeight: z.number().min(1).max(3).catch(1.75),
  contentWidth: z.enum(["compact", "normal", "wide", "full"]).catch("normal"),
  spellcheck: z.boolean().catch(true),

  // How Markdown is written, matching the remark-stringify options of the same names
  bulletMarker: z.enum(["-", "*", "+"]).catch("-"),
  emphasisMarker: z.enum(["*", "_"]).catch("*"),
  strongMarker: z.enum(["*", "_"]).catch("*"),
  fenceMarker: z.enum(["`", "~"]).catch("`"),
  ruleMarker: z.enum(["-", "*", "_"]).catch("-"),
  incrementListMarker: z.boolean().catch(true),
  lineEnding: z.enum(["auto", "lf", "crlf"]).catch("auto"),
  imageFolder: z.string().min(1).catch("assets"),

  recentFiles: z.array(z.string()).catch([]),
});

export type Settings = z.infer<typeof settingsSchema>;
export type ContentWidth = Settings["contentWidth"];
