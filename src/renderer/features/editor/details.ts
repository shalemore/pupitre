import { syntaxTree } from "@codemirror/language";
import { type EditorState, StateEffect, StateField } from "@codemirror/state";
import { type EditorView, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { textOfHtml } from "@/lib/html";
import { readDuration } from "@/lib/motion";

/**
 * Collapsible `<details>` sections whose content is Markdown.
 *
 * CommonMark ends an HTML block at the first blank line, so `<details>` with its `<summary>` and
 * the closing `</details>` are two HTML blocks with Markdown between them. Away from the selection
 * the opening block shows as its summary with a disclosure triangle and the closing block is
 * hidden; a section starts closed unless its tag has the `open` attribute, like in a browser.
 */

const OPENING = /^<details((?:\s[^>]*)?)>\s*<summary>([^]*?)<\/summary>\s*$/i;
const OPENING_TAG = /^<details[\s>]/i;
const CLOSING = /^<\/details\s*>\s*$/i;
const OPEN_ATTRIBUTE = /\sopen(?:[\s=]|$)/i;

/** Opens or closes the section whose opening block starts at the given position. */
export const toggleDetails = StateEffect.define<number>({
  map: (pos, mapping) => mapping.mapPos(pos),
});

/** Sections whose state differs from their `open` attribute, by the start of their opening block. */
export const toggledDetails = StateField.define<readonly number[]>({
  create: () => [],
  update(toggled, tr) {
    let next = tr.docChanged ? toggled.map((pos) => tr.changes.mapPos(pos)) : toggled;
    for (const effect of tr.effects) {
      if (!effect.is(toggleDetails)) continue;
      const pos = effect.value;
      next = next.includes(pos) ? next.filter((other) => other !== pos) : [...next, pos];
    }
    return next;
  },
});

export interface DetailsSection {
  /** The summary as plain text. */
  summary: string;
  open: boolean;
  /** The `</details>` block, if the section is closed at all. */
  closing: SyntaxNode | null;
}

/** The section that the HTML block `opening` starts, paired with its closing block. */
export function detailsSection(
  state: EditorState,
  opening: SyntaxNode,
): DetailsSection | undefined {
  const match = OPENING.exec(state.sliceDoc(opening.from, opening.to));
  if (!match) return undefined;
  let closing: SyntaxNode | null = null;
  let depth = 1;
  for (let sibling = opening.nextSibling; sibling && !closing; sibling = sibling.nextSibling) {
    if (sibling.name !== "HTMLBlock") continue;
    const source = state.sliceDoc(sibling.from, sibling.to);
    if (OPENING_TAG.test(source)) depth++;
    else if (CLOSING.test(source) && --depth === 0) closing = sibling;
  }
  const toggled = state.field(toggledDetails).includes(opening.from);
  return {
    summary: textOfHtml(match[2] ?? "").trim(),
    open: OPEN_ATTRIBUTE.test(match[1] ?? "") !== toggled,
    closing,
  };
}

/** How long a section takes to fold away, when the stylesheet cannot say. */
const FOLD_FALLBACK_MS = 300;

/** Which content the editor is folding or unfolding right now, as positions in the document. */
export interface DetailsAnimation {
  readonly from: number;
  readonly to: number;
  readonly closing: boolean;
}

const animateDetails = StateEffect.define<DetailsAnimation | undefined>();

/**
 * The content a section is folding or unfolding. The lines take their class from it, so they keep
 * it while the editor measures them; a class set on the DOM would be wiped by the next update.
 */
export const detailsAnimation = StateField.define<DetailsAnimation | undefined>({
  create: () => undefined,
  update(value, tr) {
    let next =
      value !== undefined && tr.docChanged
        ? {
            ...value,
            from: tr.changes.mapPos(value.from, 1),
            to: tr.changes.mapPos(value.to, -1),
          }
        : value;
    for (const effect of tr.effects) {
      if (effect.is(animateDetails)) next = effect.value;
    }
    return next;
  },
});

/** Whether this update asked a section to fold or unfold, so the lines it covers are rebuilt. */
export function detailsAnimationChanged(state: EditorState, previous: EditorState): boolean {
  return state.field(detailsAnimation, false) !== previous.field(detailsAnimation, false);
}

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
  const wait =
    closing === null
      ? 0
      : readDuration(getComputedStyle(closing).transitionDuration, FOLD_FALLBACK_MS);
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
