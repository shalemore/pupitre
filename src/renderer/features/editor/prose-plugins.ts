import type { Node } from "@milkdown/kit/prose/model";
import { Plugin } from "@milkdown/kit/prose/state";

export interface OutlineHeading {
  level: number;
  text: string;
  /** Position of the heading node, used to scroll to it. */
  pos: number;
}

const HTML_MARKUP = /<!--[^]*?-->|<[^>]*>/g;

/**
 * The text a reader sees: front matter is left out and raw HTML contributes the text between its
 * tags, so markup does not count as words or show up in the outline.
 */
export function readableText(node: Node): string {
  let text = "";
  node.descendants((child) => {
    if (child.type.name === "front_matter") return false;
    if (child.type.name === "html") {
      text += child.textContent.replace(HTML_MARKUP, "");
      return false;
    }
    if (child.isText) text += child.text;
    else if (child.isBlock && text !== "") text += "\n";
    return true;
  });
  return text;
}

export function collectHeadings(doc: Node): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return true;
    const level: unknown = node.attrs["level"];
    headings.push({ level: typeof level === "number" ? level : 1, text: readableText(node), pos });
    return false;
  });
  return headings;
}

/** The section the cursor is in: the last heading at or before the cursor. */
export function findActiveHeading(headings: readonly OutlineHeading[], cursor: number): number {
  return headings.findLastIndex((heading) => heading.pos <= cursor);
}

export interface DocumentObserver {
  onDocChange: (doc: Node) => void;
  onSelectionChange: (cursor: number) => void;
}

/** Reports document and selection changes (outline, word count, current section), only when they change. */
export function documentObserverPlugin(observer: DocumentObserver): Plugin {
  return new Plugin({
    view(initialView) {
      observer.onDocChange(initialView.state.doc);
      observer.onSelectionChange(initialView.state.selection.from);
      return {
        update({ state }, prevState) {
          if (!state.doc.eq(prevState.doc)) observer.onDocChange(state.doc);
          if (!state.selection.eq(prevState.selection))
            observer.onSelectionChange(state.selection.from);
        },
      };
    },
  });
}
