import { type EditorView, WidgetType } from "@codemirror/view";
import { renderMath } from "@/lib/markdown/mathjax";
import { fadeOut } from "./leave";
import { onReveal, onScrollbar } from "./widget-events";

/**
 * The formula an element shows, so that a rendering that finishes after a newer one was asked for
 * cannot replace it. A rendered block keeps its element across edits (updateDOM).
 */
const showing = new WeakMap<Element, string>();

export class MathWidget extends WidgetType {
  constructor(
    readonly tex: string,
    readonly display: boolean,
    /** End of the source this formula stands for, where a click on it puts the cursor. */
    readonly end?: number,
  ) {
    super();
  }

  override eq(other: MathWidget): boolean {
    return other.tex === this.tex && other.display === this.display && other.end === this.end;
  }

  toDOM(view: EditorView): HTMLElement {
    const element = document.createElement(this.display ? "div" : "span");
    element.className = this.display ? "md-math-block" : "md-math";
    onReveal(element, view, this.end);
    this.renderInto(element, view);
    return element;
  }

  /**
   * The formula under the selection is re-rendered as its source is typed; keeping the element
   * means the formula is never torn down and built again while it is being edited.
   */
  override updateDOM(dom: HTMLElement, view: EditorView, from: MathWidget): boolean {
    if (from.display !== this.display) return false;
    onReveal(dom, view, this.end);
    this.renderInto(dom, view);
    return true;
  }

  // Dragging the scrollbar of a formula wider than the line must scroll it, not start a selection
  override ignoreEvent(event: Event): boolean {
    return onScrollbar(event);
  }

  override destroy(dom: HTMLElement): void {
    if (this.display) fadeOut(dom);
  }

  private renderInto(element: HTMLElement, view: EditorView): void {
    showing.set(element, this.tex);
    void renderMath(this.tex, this.display).then((svg) => {
      if (!element.isConnected || showing.get(element) !== this.tex) return;
      element.innerHTML = svg;
      view.requestMeasure();
    });
  }
}
