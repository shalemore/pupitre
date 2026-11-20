/**
 * Waits for the event loop between two slices of a long count. A timer rather than an idle
 * callback: the count has to keep moving even while the editor is busy with a keystroke, and an
 * idle slot that never comes would leave the title bar empty.
 */
export function nextSlice(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
