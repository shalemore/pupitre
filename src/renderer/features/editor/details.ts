import { type EditorState, StateEffect, StateField } from "@codemirror/state";
import { type EditorView, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

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
const HTML_MARKUP = /<[^>]*>/g;

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
    summary: (match[2] ?? "").replace(HTML_MARKUP, "").trim(),
    open: OPEN_ATTRIBUTE.test(match[1] ?? "") !== toggled,
    closing,
  };
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
      view.dispatch({ effects: toggleDetails.of(this.pos) });
    });
    summary.append(toggle, this.summary);
    return summary;
  }

  // The triangle toggles the section; a click on the text places the cursor to edit the source
  override ignoreEvent(event: Event): boolean {
    return event.target instanceof Element && event.target.classList.contains("md-details-toggle");
  }
}
