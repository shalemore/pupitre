import { EditorView, WidgetType } from "@codemirror/view";
import type { OutlineHeading } from "./document-structure";

/** A paragraph that is only this marker stands for the table of contents. */
export const TOC_MARKER = /^\[TOC\]$/i;

/** The headings of the document as a list of links to them, for a `[TOC]` paragraph. */
export class TocWidget extends WidgetType {
  constructor(readonly headings: readonly OutlineHeading[]) {
    super();
  }

  override eq(other: TocWidget): boolean {
    return (
      other.headings.length === this.headings.length &&
      this.headings.every((heading, i) => {
        const same = other.headings[i];
        return (
          same?.pos === heading.pos && same.level === heading.level && same.text === heading.text
        );
      })
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const list = document.createElement("ul");
    list.className = "md-toc";
    const top = Math.min(...this.headings.map((heading) => heading.level));
    for (const { level, text, pos } of this.headings) {
      const item = document.createElement("li");
      item.style.paddingInlineStart = `${level - top}em`;
      const link = document.createElement("span");
      link.className = "md-link";
      link.textContent = text;
      link.addEventListener("mousedown", (event) => {
        event.preventDefault();
        view.dispatch({
          selection: { anchor: pos },
          effects: EditorView.scrollIntoView(pos, { y: "start" }),
        });
      });
      item.append(link);
      list.append(item);
    }
    return list;
  }
}
