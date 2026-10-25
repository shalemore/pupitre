import type { EditorView } from "@codemirror/view";

/** The rendered blocks that scroll sideways when they are wider than the line (editor.css). */
const SCROLL_BOX = ".md-math-block, .md-mermaid";

/**
 * Whether a mouse event landed on the scrollbar of a block wider than the line. Dragging it has to
 * scroll the block, not move the cursor, which would reveal the source of the block being dragged.
 * A click anywhere else, including on a formula or a diagram that could not be rendered, places the
 * cursor and so reveals the source.
 */
export function onScrollbar(event: Event): boolean {
  if (!(event instanceof MouseEvent) || !(event.target instanceof Element)) return false;
  const box = event.target;
  return (
    box.matches(SCROLL_BOX) &&
    (event.offsetX >= box.clientWidth || event.offsetY >= box.clientHeight)
  );
}

/**
 * Puts the cursor at `end` when the rendering is clicked, so that the source opens at its end,
 * ready to take what is typed next, instead of at the start of its first line.
 */
export function onReveal(element: HTMLElement, view: EditorView, end: number | undefined): void {
  if (end === undefined) return;

  element.addEventListener("mousedown", (event) => {
    if (event.button !== 0 || onScrollbar(event)) return;
    // The editor would place the cursor at the start of the block it replaces
    event.preventDefault();
    event.stopPropagation();
    view.focus();
    view.dispatch({ selection: { anchor: end }, scrollIntoView: true });
  });
}
