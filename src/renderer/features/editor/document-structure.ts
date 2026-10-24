import { syntaxTree } from "@codemirror/language";
import type { EditorState, Extension } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";

export interface OutlineHeading {
  level: number;
  text: string;
  /** Start of the heading in the document, used to scroll to it. */
  pos: number;
}

const HEADING = /^(?:ATX|Setext)Heading([1-6])$/;
const LEAF_BLOCK = /^(?:Paragraph|FencedCode|CodeBlock|HTMLBlock|Table|FrontMatter)$/;
const HTML_MARKUP = /<!--[^]*?-->|<[^>]*>/g;
/** Source that a reader never sees: link destinations, code languages, markup, front matter. */
const UNREAD_NODES = new Set([
  "FrontMatter",
  "LinkTitle",
  "LinkLabel",
  "LinkReference",
  "FootnoteLabel",
  "CodeInfo",
  "HTMLTag",
  "Comment",
  "ProcessingInstruction",
  "TableDelimiter",
  "TaskMarker",
]);

function isUnread(name: string, parent: string | undefined): boolean {
  if (name === "URL") return parent === "Link" || parent === "Image";
  return name.endsWith("Mark") || UNREAD_NODES.has(name);
}

/**
 * The text a reader sees between `from` and `to`: Markdown syntax, link destinations and front
 * matter are left out and raw HTML contributes the text between its tags, so markup does not count
 * as words or show up in the outline.
 */
export function readableText(state: EditorState, from = 0, to = state.doc.length): string {
  let text = "";
  let pos = from;
  const skipTo = (start: number, end: number) => {
    if (start > pos) text += state.sliceDoc(pos, start);
    pos = Math.max(pos, end);
  };
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      const start = Math.max(node.from, from);
      const end = Math.min(node.to, to);
      if (node.name === "Escape") {
        skipTo(start, start + 1);
        return false;
      }
      if (node.name === "HTMLBlock" || node.name === "CommentBlock") {
        skipTo(start, end);
        text += state.sliceDoc(start, end).replace(HTML_MARKUP, "");
        return false;
      }
      if (!isUnread(node.name, node.node.parent?.name)) return true;
      skipTo(start, end);
      return false;
    },
  });
  skipTo(to, to);
  return text;
}

export function collectHeadings(state: EditorState): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      const level = HEADING.exec(node.name)?.[1];
      // Headings never sit inside leaf blocks, so their content need not be walked
      if (level === undefined) return !LEAF_BLOCK.test(node.name);
      const text = readableText(state, node.from, node.to).trim();
      headings.push({ level: Number(level), text, pos: node.from });
      return false;
    },
  });
  return headings;
}

/** The anchor a heading gets, written like GitHub does: lowercase, punctuation dropped, spaces as hyphens. */
function headingAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
    .replaceAll(/\s/g, "-");
}

/** The heading a `#anchor` link points to; repeated headings are told apart by -1, -2… as on GitHub. */
export function findHeadingByAnchor(
  headings: readonly OutlineHeading[],
  anchor: string,
): OutlineHeading | undefined {
  let wanted: string;
  try {
    wanted = decodeURIComponent(anchor).toLowerCase();
  } catch {
    return undefined;
  }
  const seen = new Map<string, number>();
  return headings.find(({ text }) => {
    const base = headingAnchor(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return (count === 0 ? base : `${base}-${count}`) === wanted;
  });
}

/** The section the cursor is in: the last heading at or before the cursor. */
export function findActiveHeading(headings: readonly OutlineHeading[], cursor: number): number {
  return headings.findLastIndex((heading) => heading.pos <= cursor);
}

export interface DocumentObserver {
  onDocChange: (state: EditorState) => void;
  onSelectionChange: (cursor: number) => void;
}

/**
 * Reports document and selection changes (outline, word count, current section), only when they
 * change. Long documents are parsed in the background, so a grown syntax tree counts as a change.
 */
export function documentObserver(observer: DocumentObserver): Extension {
  return ViewPlugin.define((view) => {
    observer.onDocChange(view.state);
    observer.onSelectionChange(view.state.selection.main.from);
    return {
      update: (update) => {
        if (update.docChanged || syntaxTree(update.state) !== syntaxTree(update.startState)) {
          observer.onDocChange(update.state);
        }
        if (update.selectionSet) observer.onSelectionChange(update.state.selection.main.from);
      },
    };
  });
}
