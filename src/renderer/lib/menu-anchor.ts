/** The rect a menu opens from when it was opened at the pointer, which has no size. */
export function pointerAnchor(event: MouseEvent): DOMRect {
  return new DOMRect(event.clientX, event.clientY, 0, 0);
}
