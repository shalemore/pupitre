import { type EditorView, WidgetType } from "@codemirror/view";
import { messageOf } from "@shared/errors";
import { fadeOut } from "@/features/editor/leave";
import { onReveal, onScrollbar } from "@/features/editor/widget-events";
import { type DiagramTheme, renderDiagram } from "@/lib/markdown/mermaid";

/**
 * The diagram source an element shows, so that a rendering that finishes after a newer one was
 * asked for cannot replace it. A diagram keeps its element across edits (updateDOM).
 */
const showing = new WeakMap<Element, string>();

export class MermaidWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly theme: DiagramTheme,
    /** End of the source this diagram stands for, where a click on it puts the cursor. */
    readonly end?: number,
  ) {
    super();
  }

  override eq(other: MermaidWidget): boolean {
    return other.source === this.source && other.theme === this.theme && other.end === this.end;
  }

  toDOM(view: EditorView): HTMLElement {
    const element = document.createElement("div");
    element.className = "md-mermaid";
    onReveal(element, view, this.end);
    this.renderInto(element, view);
    return element;
  }

  // As with math, the scrollbar of a diagram wider than the line must scroll it, not select text
  override ignoreEvent(event: Event): boolean {
    return onScrollbar(event);
  }

  /** The diagram under the selection is re-rendered as its source is typed, in the same element. */
  override updateDOM(dom: HTMLElement, view: EditorView): boolean {
    onReveal(dom, view, this.end);
    this.renderInto(dom, view);
    return true;
  }

  override destroy(dom: HTMLElement): void {
    fadeOut(dom);
  }

  private renderInto(element: HTMLElement, view: EditorView): void {
    showing.set(element, this.source);
    element.classList.remove("is-invalid");
    renderDiagram(this.source, this.theme).then(
      (svg) => {
        if (!element.isConnected || showing.get(element) !== this.source) return;
        // Mermaid's default strict security level sanitizes the diagram source it renders
        element.innerHTML = svg;
        view.requestMeasure();
      },
      (error: unknown) => {
        if (!element.isConnected || showing.get(element) !== this.source) return;
        element.classList.add("is-invalid");
        element.textContent = messageOf(error);
        view.requestMeasure();
      },
    );
  }
}
