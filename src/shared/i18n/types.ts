export type Direction = "ltr" | "rtl";

export const LOCALE_CODES = [
  "en-US",
  "ar-SA",
  "de-DE",
  "es-ES",
  "fr-FR",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "pt-BR",
  "ru-RU",
  "zh-CN",
  "zh-TW",
] as const;

export type SupportedLocale = (typeof LOCALE_CODES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en-US";

export type LanguageSetting = "auto" | SupportedLocale;

export interface LocaleMeta {
  readonly code: SupportedLocale;
  readonly label: string;
  readonly dir: Direction;
}

export interface TranslationSchema {
  readonly common: {
    readonly appName: string;
    readonly untitledFileName: string;
    readonly wordsCount: (count: number) => string;
    readonly charsCount: (count: number) => string;
    readonly copy: string;
  };
  readonly actions: {
    readonly newDoc: string;
    readonly openDoc: string;
  };
  readonly sidebar: {
    readonly noHeadings: string;
  };
  readonly welcome: {
    readonly dragDropHint: string;
  };
  readonly editor: {
    readonly toggleReplace: string;
    readonly placeholder: string;
    readonly groupText: string;
    readonly groupList: string;
    readonly groupInsert: string;
    readonly paragraph: string;
    readonly quote: string;
    readonly divider: string;
    readonly bulletList: string;
    readonly orderedList: string;
    readonly taskList: string;
    readonly image: string;
    readonly codeBlock: string;
    readonly table: string;
    readonly math: string;
    readonly bold: string;
    readonly italic: string;
    readonly strikethrough: string;
    readonly inlineCode: string;
    readonly link: string;
    readonly searchLanguage: string;
    readonly noLanguage: string;
    readonly preview: string;
    readonly editSource: string;
    readonly hidePreview: string;
    readonly upload: string;
    readonly confirm: string;
    readonly imageUrlPlaceholder: string;
    readonly captionPlaceholder: string;
    readonly linkPlaceholder: string;
    readonly remove: string;
    readonly findPlaceholder: string;
    readonly replacePlaceholder: string;
    readonly replaceOne: string;
    readonly replaceAll: string;
    readonly matchCase: string;
    readonly wholeWord: string;
    readonly useRegex: string;
    readonly previousMatch: string;
    readonly nextMatch: string;
    readonly closeFind: string;
    readonly heading: (level: number) => string;
  };
  readonly dialogs: {
    readonly copyButton: string;
    readonly okButton: string;
    readonly unsavedMessage: (fileName: string) => string;
    readonly unsavedDetail: string;
    readonly save: string;
    readonly dontSave: string;
    readonly cancel: string;
    readonly openFailed: string;
  };
  readonly about: {
    readonly windowTitle: string;
    readonly versionLabel: string;
    readonly osLabel: string;
    readonly openSampleDoc: string;
    readonly sampleDocTitle: string;
    readonly sampleDocDesc: string;
  };
  readonly menu: {
    readonly file: string;
    readonly edit: string;
    readonly view: string;
    readonly help: string;
    readonly newFile: string;
    readonly openFile: string;
    readonly openRecent: string;
    readonly noRecentFiles: string;
    readonly save: string;
    readonly saveAs: string;
    readonly exportPdf: string;
    readonly close: string;
    readonly undo: string;
    readonly redo: string;
    readonly cut: string;
    readonly copy: string;
    readonly paste: string;
    readonly selectAll: string;
    readonly find: string;
    readonly replace: string;
    readonly zoomIn: string;
    readonly zoomOut: string;
    readonly resetZoom: string;
    readonly toggleSidebar: string;
    readonly toggleTheme: string;
    readonly preferences: string;
    readonly sampleDocument: string;
    readonly about: string;
    readonly documentation: string;
    readonly clearRecent: string;
    readonly quit: string;
    readonly pastePlain: string;
    readonly fullScreen: string;
    readonly reportIssue: string;
  };
  readonly settings: {
    readonly title: string;
    readonly general: string;
    readonly appearance: string;
    readonly editor: string;
    readonly markdown: string;
    readonly about: string;
    readonly language: string;
    readonly languageDesc: string;
    readonly followSystem: string;
    readonly startup: string;
    readonly startupDesc: string;
    readonly startupWelcome: string;
    readonly startupLastFile: string;
    readonly startupNewFile: string;
    readonly autoSave: string;
    readonly autoSaveDesc: string;
    readonly autoCheckUpdates: string;
    readonly autoCheckUpdatesDesc: string;
    readonly colorScheme: string;
    readonly colorSchemeDesc: string;
    readonly colorSchemeLight: string;
    readonly colorSchemeDark: string;
    readonly theme: string;
    readonly themeDesc: string;
    readonly animations: string;
    readonly animationsDesc: string;
    readonly animationsOn: string;
    readonly animationsOff: string;
    readonly showOutline: string;
    readonly showOutlineDesc: string;
    readonly showWordCount: string;
    readonly showWordCountDesc: string;
    readonly bodyFont: string;
    readonly bodyFontDesc: string;
    readonly fallbackFont: string;
    readonly fallbackFontDesc: string;
    readonly codeFont: string;
    readonly codeFontDesc: string;
    readonly themeDefault: string;
    readonly noFallbackFont: string;
    readonly searchFont: string;
    readonly fontSize: string;
    readonly lineHeight: string;
    readonly contentWidth: string;
    readonly contentWidthDesc: string;
    readonly widthCompact: string;
    readonly widthNormal: string;
    readonly widthWide: string;
    readonly widthFull: string;
    readonly spellcheck: string;
    readonly spellcheckDesc: string;
    readonly markdownDesc: string;
    readonly bulletMarker: string;
    readonly emphasisMarker: string;
    readonly strongMarker: string;
    readonly fenceMarker: string;
    readonly ruleMarker: string;
    readonly orderedList: string;
    readonly orderedListIncrement: string;
    readonly orderedListSame: string;
    readonly lineEnding: string;
    readonly lineEndingAuto: string;
    readonly imageFolder: string;
    readonly imageFolderDesc: string;
    readonly version: string;
    readonly checkForUpdates: string;
    readonly checkingForUpdates: string;
    readonly updateAvailable: string;
    readonly upToDate: string;
    readonly downloadUpdate: string;
    readonly downloadingUpdate: string;
    readonly updateReady: string;
    readonly restartToApply: string;
    readonly updateErrorGeneric: string;
    readonly settingsFile: string;
    readonly revealSettingsFile: string;
    readonly updateNotificationTitle: (version: string) => string;
    readonly updateNotificationBody: string;
    readonly refreshFonts: string;
  };
}
