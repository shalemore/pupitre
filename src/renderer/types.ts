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
