import { EditorView, WidgetType } from "@codemirror/view";
import { fadeOut } from "@/features/editor/leave";
import type { OutlineHeading } from "@/lib/markdown/structure";

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
    list.append(...this.items(view));
    return list;
  }

  /** A heading edited elsewhere moves the links, which are rebuilt in the list that stands here. */
  override updateDOM(dom: HTMLElement, view: EditorView): boolean {
    dom.replaceChildren(...this.items(view));
    return true;
  }

  override destroy(dom: HTMLElement): void {
    fadeOut(dom);
  }

  private items(view: EditorView): HTMLElement[] {
    const top = Math.min(...this.headings.map((heading) => heading.level));
    return this.headings.map(({ level, text, pos }) => {
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
      return item;
    });
  }
}
