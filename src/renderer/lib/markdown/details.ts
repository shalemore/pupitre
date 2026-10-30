import { type EditorState, StateEffect, StateField } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import { textOfHtml } from "@/lib/html";

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

/** Which content the editor is folding or unfolding right now, as positions in the document. */
export interface DetailsAnimation {
  readonly from: number;
  readonly to: number;
  readonly closing: boolean;
}

export const animateDetails = StateEffect.define<DetailsAnimation | undefined>();

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
