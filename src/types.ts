export interface Block {
  id: string;
  type: string;
  raw: string;
  sourceRange: [number, number]; // [start, end]
  headingLevel?: number | undefined;
  headingText?: string | undefined;
}

export interface HeadingItem {
  blockIndex: number;
  level: number;
  title: string;
  pos?: number;
}

export interface DocumentStats {
  words: number;
  chars: number;
}

export interface AppActionHandlers {
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (filePath: string) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportPdf?: (() => void) | undefined;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onOpenSample?: (() => void) | undefined;
  onFind?: (() => void) | undefined;
  onReplace?: (() => void) | undefined;
  onZoomIn?: (() => void) | undefined;
  onZoomOut?: (() => void) | undefined;
  onZoomReset?: (() => void) | undefined;
  recentFiles: string[];
}
