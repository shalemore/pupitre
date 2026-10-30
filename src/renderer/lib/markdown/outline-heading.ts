export interface OutlineHeading {
  level: number;
  text: string;
  /** Start of the heading in the document, used to scroll to it. */
  pos: number;
}

/**
 * What tells one outline heading apart from another: its level and its text. A position would move
 * with every edit above the heading and open a collapsed section again while the document is
 * being written.
 */
export function headingKey(heading: OutlineHeading): string {
  return `${heading.level}:${heading.text}`;
}
