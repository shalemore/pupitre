import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { type EditorView, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { animateDetails, detailsSection, toggleDetails } from "@/lib/markdown/details";
import { readDuration } from "@/lib/motion";

/** The opening block a section starts with, from the position its summary stands for. */
function openingBlock(state: EditorState, pos: number): SyntaxNode | undefined {
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos + 1, 1);
    node;
    node = node.parent
  ) {
    if (node.name === "HTMLBlock") return node;
  }
  return undefined;
}

/**
 * Opens or closes a section the way the outline rows do: the content it folds shrinks to nothing
 * first, and the lines it brings in grow back from nothing. Content the selection is editing stays
 * shown either way, since the source is what is being written there.
 */
function toggleSection(view: EditorView, pos: number, open: boolean): void {
  const state = view.state;
  const opening = openingBlock(state, pos);
  const section = opening && detailsSection(state, opening);
  const from = opening ? state.doc.lineAt(opening.to).to + 1 : pos;
  const to = section?.closing ? state.doc.lineAt(section.closing.from).from - 1 : state.doc.length;
  const sourceEditing = state.selection.ranges.some(
    (range) => range.from <= to && range.to >= from,
  );
  if (sourceEditing || opening === undefined || from > to) {
    view.dispatch({ effects: toggleDetails.of(pos) });
    return;
  }
  if (!open) {
    view.dispatch({
      effects: [toggleDetails.of(pos), animateDetails.of({ from, to, closing: false })],
    });
    return;
  }
  // The content folds first, and the section changes once it has gone. The wait is the transition
  // the stylesheet gave the lines, so a theme that changes its motion is followed, and a motion
  // turned off makes it immediate
  view.dispatch({ effects: animateDetails.of({ from, to, closing: true }) });
  const closing = view.dom.querySelector<HTMLElement>(".md-details-closing");
  const wait = closing === null ? 0 : readDuration(getComputedStyle(closing).transitionDuration);
  window.setTimeout(() => {
    const current = openingBlock(view.state, pos);
    // The document may have changed under the animation; only close what is still open there
    if (current !== undefined && detailsSection(view.state, current)?.open) {
      view.dispatch({ effects: [toggleDetails.of(pos), animateDetails.of(undefined)] });
    }
  }, wait + 16);
}

export class SummaryWidget extends WidgetType {
  constructor(
    readonly summary: string,
    readonly open: boolean,
    /** Start of the opening block, which identifies the section when it is toggled. */
    readonly pos: number,
  ) {
    super();
  }

  override eq(other: SummaryWidget): boolean {
    return other.summary === this.summary && other.open === this.open && other.pos === this.pos;
  }

  toDOM(view: EditorView): HTMLElement {
    const summary = document.createElement("div");
    summary.className = this.open ? "md-details-summary is-open" : "md-details-summary";
    const toggle = document.createElement("span");
    toggle.className = "md-details-toggle";
    toggle.addEventListener("mousedown", (event) => {
      event.preventDefault();
      toggleSection(view, this.pos, this.open);
    });
    summary.append(toggle, this.summary);
    return summary;
  }

  // The triangle toggles the section; a click on the text places the cursor to edit the source
  override ignoreEvent(event: Event): boolean {
    return event.target instanceof Element && event.target.classList.contains("md-details-toggle");
  }
}
