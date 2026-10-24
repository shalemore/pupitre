export type Direction = "ltr" | "rtl";

/**
 * BCP 47 tags. Most use the region CLDR gives each language by default (not always its
 * homeland, hence en-US and pt-BR). Arabic carries no region because it is the standard
 * language, understood everywhere it is read, not a regional dialect. The region only
 * carries meaning for Portuguese, whose Brazilian and European forms are different
 * languages in practice, and for the three Chinese standards.
 */
export const LOCALE_CODES = [
  "en-US",
  "ar",
  "cs-CZ",
  "da-DK",
  "de-DE",
  "el-GR",
  "es-ES",
  "fa-IR",
  "fi-FI",
  "fr-FR",
  "hi-IN",
  "hu-HU",
  "id-ID",
  "is-IS",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "nb-NO",
  "nl-NL",
  "pl-PL",
  "pt-BR",
  "pt-PT",
  "ru-RU",
  "sv-SE",
  "th-TH",
  "tr-TR",
  "uk-UA",
  "vi-VN",
  "zh-CN",
  "zh-HK",
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

export interface LocaleEntry extends Omit<LocaleMeta, "code"> {
  readonly dictionary: TranslationSchema;
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
    readonly outline: string;
    readonly folder: string;
    readonly folderUnreadable: string;
  };
  readonly welcome: {
    readonly dragDropHint: string;
  };
  readonly editor: {
    readonly toggleReplace: string;
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
    readonly placeholder: string;
    readonly alerts: {
      readonly note: string;
      readonly tip: string;
      readonly important: string;
      readonly warning: string;
      readonly caution: string;
    };
    /** Toolbar of a rendered table; start and end follow the text direction. */
    readonly table: {
      readonly alignStart: string;
      readonly alignCenter: string;
      readonly alignEnd: string;
      readonly insertRowAbove: string;
      readonly insertRowBelow: string;
      readonly insertColumnBefore: string;
      readonly insertColumnAfter: string;
      readonly deleteRow: string;
      readonly deleteColumn: string;
      readonly deleteTable: string;
    };
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
    readonly externalChangeMessage: (fileName: string) => string;
    readonly externalChangeDetail: string;
    readonly overwrite: string;
    readonly reload: string;
    readonly keepEditing: string;
    readonly fileDeletedMessage: (fileName: string) => string;
    readonly fileDeletedDetail: string;
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
    readonly openFolder: string;
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
    readonly format: string;
    readonly paragraphMenu: string;
    readonly focusMode: string;
    readonly typewriterMode: string;
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
    readonly sidebarLayout: string;
    readonly sidebarLayoutDesc: string;
    readonly sidebarLayoutSplit: string;
    readonly sidebarLayoutCombined: string;
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
    readonly scrollbar: string;
    readonly scrollbarDesc: string;
    readonly scrollbarAuto: string;
    readonly scrollbarAlways: string;
    readonly scrollbarNever: string;
    readonly scrollFade: string;
    readonly scrollFadeDesc: string;
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
    readonly resetToDefault: string;
    readonly darkTheme: string;
    readonly darkThemeDesc: string;
    readonly sameTheme: string;
    readonly schemeBoth: string;
    readonly uiFont: string;
    readonly uiFontDesc: string;
    readonly systemDefault: string;
    readonly focusMode: string;
    readonly focusModeDesc: string;
    readonly typewriterMode: string;
    readonly typewriterModeDesc: string;
    readonly windowStyle: string;
    readonly windowStyleDesc: string;
    readonly windowStyleClassic: string;
    readonly windowStyleImmersive: string;
    readonly defaultApp: string;
    readonly defaultAppDesc: string;
    readonly setAsDefault: string;
    readonly defaultAppDone: string;
    readonly defaultAppOpenedSettings: string;
    readonly defaultAppManual: string;
    readonly defaultAppFailed: string;
  };
  readonly format: {
    readonly bold: string;
    readonly italic: string;
    readonly strikethrough: string;
    readonly inlineCode: string;
    readonly link: string;
    readonly paragraph: string;
    readonly quote: string;
    readonly orderedList: string;
    readonly bulletList: string;
    readonly codeBlock: string;
    readonly mathBlock: string;
    readonly table: string;
    readonly divider: string;
    readonly heading1: string;
    readonly heading2: string;
    readonly heading3: string;
    readonly heading4: string;
    readonly heading5: string;
    readonly heading6: string;
  };
  readonly window: {
    readonly minimize: string;
    readonly maximize: string;
    readonly restore: string;
    readonly close: string;
  };
}
