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
