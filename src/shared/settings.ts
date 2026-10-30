import { z } from "zod";
import { LOCALE_CODES } from "./i18n/types";

/**
 * The range and step of every setting that is a number on a slider, shared with the settings
 * window so that what the window offers is what the settings file may hold.
 */
export const SETTING_RANGES = {
  fontSize: { min: 10, max: 32, step: 1 },
  lineHeight: { min: 1, max: 3, step: 0.05 },
  zoom: { min: 50, max: 300, step: 10 },
  immersiveGap: { min: 0, max: 24, step: 1 },
} as const;

/** What Ctrl+plus, Ctrl+minus and Ctrl+wheel step through, the way a browser does. */
export const ZOOM_STEPS = [
  SETTING_RANGES.zoom.min,
  60,
  70,
  80,
  90,
  100,
  110,
  125,
  150,
  175,
  200,
  250,
  SETTING_RANGES.zoom.max,
] as const;

/** The zoom setting is a percentage; hosts want the factor it means. */
export function zoomFactor(percent: number): number {
  return percent / 100;
}

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
  colorScheme: z.enum(["system", "light", "dark"]).catch("light"),
  /** Theme folder name, see src/renderer/themes. */
  theme: z.string().min(1).catch("pupitre"),
  /** Theme used while the dark color scheme is active; empty means the same as `theme`. */
  darkTheme: z.string().catch(""),
  /** Font of menus, sidebar and dialogs; empty means the platform's interface font. */
  uiFont: z.string().catch(""),
  animations: z.enum(["system", "on", "off"]).catch("system"),
  /** Zoom of the main window in percent; Ctrl+plus, Ctrl+minus and Ctrl+wheel step it. */
  zoom: z.number().min(SETTING_RANGES.zoom.min).max(SETTING_RANGES.zoom.max).catch(100),
  /** Read when a window is created, so a change applies to windows opened afterwards. */
  windowStyle: z.enum(["classic", "immersive"]).catch("classic"),
  /**
   * Whether each document opens in a tab of its own; off, opening a document replaces the one on
   * show, after the prompt its unsaved changes ask for.
   */
  tabs: z.boolean().catch(false),
  /** Whether a window with tabs keeps the tab bar hidden while only one document is open. */
  hideSingleTab: z.boolean().catch(true),
  /** Gap the document card keeps to the window edges, its title bar and its sidebars, in px. */
  immersiveGap: z
    .number()
    .min(SETTING_RANGES.immersiveGap.min)
    .max(SETTING_RANGES.immersiveGap.max)
    .catch(8),
  sidebarVisible: z.boolean().catch(true),
  /** Whether the folder shows the first lines of each file under its name. */
  sidebarPreview: z.boolean().catch(false),
  /** Whether the folder also shows the entries the system or another tool hides. */
  showHidden: z.boolean().catch(false),
  /** How the folder orders the entries of the open folder. */
  folderSort: z.enum(["name", "modified", "created"]).catch("name"),
  /** Folder and outline in two sidebars, one at each edge, or as tabs of one sidebar. */
  sidebarLayout: z.enum(["split", "combined"]).catch("split"),
  /**
   * An immersive window folds its sidebars away while the user writes, unless they are pinned. Each
   * edge has its own pin, so in the split layout the folder and the outline fold independently; a
   * combined layout only has the start one.
   */
  sidebarPinnedStart: z.boolean().catch(false),
  sidebarPinnedEnd: z.boolean().catch(false),
  showWordCount: z.boolean().catch(true),
  focusMode: z.boolean().catch(false),
  /** Whether focus mode keeps the line being written sharp, or the whole block around it. */
  focusModeGrain: z.enum(["line", "block"]).catch("line"),
  typewriterMode: z.boolean().catch(false),
  /** Where typewriter mode holds the line being written. */
  typewriterPosition: z.enum(["center", "top", "bottom"]).catch("center"),
  /** Whether it holds that place for the first and the last line too, which takes room above and below. */
  typewriterFixed: z.boolean().catch(true),
  /** Shows the Markdown source instead of the rendered document while typing. */
  sourceMode: z.boolean().catch(false),

  // Editor; an empty font name means "use the theme's font"
  bodyFont: z.string().catch(""),
  fallbackFont: z.string().catch(""),
  codeFont: z.string().catch(""),
  fontSize: z.number().min(SETTING_RANGES.fontSize.min).max(SETTING_RANGES.fontSize.max).catch(14),
  lineHeight: z
    .number()
    .min(SETTING_RANGES.lineHeight.min)
    .max(SETTING_RANGES.lineHeight.max)
    .catch(1.75),
  contentWidth: z.enum(["compact", "normal", "wide", "full"]).catch("normal"),
  spellcheck: z.boolean().catch(false),
  cursorShape: z.enum(["bar", "block", "underline"]).catch("bar"),
  /** `system` keeps the platform's own caret blinking. */
  cursorBlink: z.enum(["system", "smooth", "off"]).catch("system"),
  scrollbar: z.enum(["auto", "always", "never"]).catch("auto"),
  scrollFade: z.boolean().catch(false),
  /** Types curly quotes instead of straight ones, except in code, math and front matter. */
  smartQuotes: z.boolean().catch(false),
  /** Types en and em dashes and an ellipsis for `--`, `---` and `...`, except in code, math and front matter. */
  smartDashes: z.boolean().catch(false),
  /** Pairs Markdown markers such as `*` and `$` as well as brackets and quotes. */
  autoPairMarkdown: z.boolean().catch(false),
  /** Whether an exported PDF numbers its pages at the foot. */
  pdfPageNumbers: z.boolean().catch(false),
  pdfPageSize: z.enum(["a4", "letter", "legal"]).catch("a4"),
  pdfMargin: z.enum(["none", "narrow", "normal", "wide"]).catch("normal"),

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

/** The width of the reading column each `contentWidth` choice asks for. */
export const CONTENT_WIDTHS: Record<ContentWidth, string> = {
  compact: "42rem",
  normal: "52rem",
  wide: "64rem",
  full: "none",
};

export const SETTING_KEYS = settingsSchema.keyof().options;

/** Where a folder keeps its own settings, relative to the folder; the format is that of the global file. */
export const WORKSPACE_FILE = ".pupitre/settings.json";

/**
 * What belongs to the app and not to a folder: both are read before any folder is open, or have
 * nothing to do with one. Every other setting can be given a value of its own for a folder.
 */
const APP_KEYS: readonly SettingKey[] = [
  "startup",
  "autoCheckUpdates",
  "sourceMode",
  "tabs",
  "hideSingleTab",
];

export function isWorkspaceKey(key: string): boolean {
  return !APP_KEYS.some((appKey) => appKey === key);
}
export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

/** Reads a parsed settings file; anything that is not an object counts as "nothing changed". */
export function resolveSettings(file: unknown): Settings {
  return settingsSchema.catch(DEFAULT_SETTINGS).parse(file);
}

/** A settings file: an object that holds the settings that differ from what they would be without it. */
export const settingsFileSchema = z.record(z.string(), z.unknown()).catch({});

/**
 * The file after a patch. A value equal to `unset`, what the setting is without an entry in the
 * file, is removed instead of written. `applies` limits the patch to the keys that belong in it.
 */
export function patchSettingsFile(
  file: Record<string, unknown>,
  patch: Partial<Settings>,
  unset: Settings,
  applies: (key: SettingKey) => boolean = () => true,
): Record<string, unknown> {
  const next = { ...file };
  for (const key of SETTING_KEYS) {
    if (!(key in patch) || !applies(key)) continue;
    const value = patch[key];
    if (value === undefined || Object.is(value, unset[key])) delete next[key];
    else next[key] = value;
  }
  return next;
}

export function withoutSetting(
  file: Record<string, unknown>,
  key: SettingKey,
): Record<string, unknown> {
  const { [key]: _removed, ...rest } = file;
  return rest;
}

export function isModified(settings: Settings, key: SettingKey): boolean {
  return !Object.is(settings[key], DEFAULT_SETTINGS[key]);
}
