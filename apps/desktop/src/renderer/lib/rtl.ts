/** Whether the window reads right to left. */
export function isRtl(): boolean {
  return document.documentElement.dir === "rtl";
}

/** How far the pointer is from the edge the window starts at, which is the right one when it reads right to left. */
export function distanceFromStart(clientX: number): number {
  return isRtl() ? window.innerWidth - clientX : clientX;
}

/** How far the pointer is from the edge the window ends at. */
export function distanceFromEnd(clientX: number): number {
  return window.innerWidth - distanceFromStart(clientX);
}
