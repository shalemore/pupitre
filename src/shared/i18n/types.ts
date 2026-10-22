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
    readonly copied: string;
  };
  readonly actions: {
    readonly newDoc: string;
    readonly openDoc: string;
    readonly saveDoc: string;
  };
  readonly shortcuts: {
    readonly newDocTip: string;
    readonly openDocTip: string;
    readonly saveDocTip: string;
    readonly toggleThemeLight: string;
    readonly toggleThemeDark: string;
    readonly switchLangTip: string;
  };
  readonly sidebar: {
    readonly outline: string;
    readonly sectionsCount: (count: number) => string;
    readonly noHeadings: string;
  };
  readonly welcome: {
    readonly tagline: string;
    readonly subTagline1: string;
    readonly subTagline2: string;
    readonly startWriting: string;
    readonly openFile: string;
    readonly shortcutsHint: string;
    readonly dragDropHint: string;
  };
  readonly editor: {
    readonly appendPlaceholder: string;
    readonly editCode: string;
    readonly clickToEdit: string;
    readonly dblClickToEdit: string;
    readonly livePreview: string;
    readonly waitingDiagramSyntax: string;
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
  readonly settings: {
    readonly language: string;
    readonly followSystem: string;
    readonly title: string;
    readonly appearance: string;
    readonly editor: string;
    readonly about: string;
    readonly theme: string;
    readonly themeSystem: string;
    readonly themeLight: string;
    readonly themeDark: string;
    readonly animations: string;
    readonly animationsDesc: string;
    readonly animationsSystem: string;
    readonly animationsOn: string;
    readonly animationsOff: string;
    readonly typography: string;
    readonly fontSize: string;
    readonly lineHeight: string;
    readonly fontFamily: string;
    readonly primaryFont: string;
    readonly fallbackFont: string;
    readonly refreshFonts: string;
    readonly searchFont: string;
    readonly fontFallbackNone: string;
    readonly fontFamilySans: string;
    readonly fontFamilyMono: string;
    readonly fontFamilySerif: string;
    readonly behavior: string;
    readonly tabSize: string;
    readonly tabSizeDesc: string;
    readonly wordWrap: string;
    readonly wordWrapDesc: string;
    readonly blockSpacing: string;
    readonly blockSpacingDesc: string;
    readonly editorWidth: string;
    readonly editorWidthCompact: string;
    readonly editorWidthNormal: string;
    readonly editorWidthWide: string;
    readonly editorWidthFull: string;
    readonly autoSave: string;
    readonly autoSaveDesc: string;
    readonly configFile: string;
    readonly version: string;
    readonly openConfigFile: string;
    readonly closeTip: string;
    readonly checkForUpdates: string;
    readonly checkingForUpdates: string;
    readonly updateAvailable: string;
    readonly upToDate: string;
    readonly downloadUpdate: string;
    readonly downloadingUpdate: string;
    readonly restartToApply: string;
    readonly updateErrorGeneric: string;
    readonly updateReady: string;
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
    readonly shortcuts: string;
  };
}
