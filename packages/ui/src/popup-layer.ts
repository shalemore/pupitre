/**
 * The element a window keeps for floating panels, below its title bar; a host without one falls
 * back to the body, where the panel may use the whole viewport.
 */
export function popupLayer(): Node {
  return document.querySelector<HTMLElement>("[data-popup-layer]") ?? document.body;
}
