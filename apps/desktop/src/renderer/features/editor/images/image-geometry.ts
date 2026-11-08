import { type ImageSize, imageStyle } from "@pupitre/markdown";

/**
 * The inline geometry of a picture: the declarations its source carries, the width a drag shows
 * before it is written, and the room kept for one that failed to load. Everything that sizes a
 * picture on the page goes through here.
 */

/** Puts a picture and its frame at the size and alignment its source carries. */
export function applyImageLayout(
  frame: HTMLElement,
  image: HTMLImageElement,
  size: ImageSize,
): void {
  // The frame holds the alignment, which a picture of its own width cannot carry
  frame.style.cssText = imageStyle(size);
  applyImageWidth(image, size.width);
}

/** Shows a picture at a width the source does not know yet; `undefined` returns it to its own. */
export function applyImageWidth(image: HTMLImageElement, width: number | undefined): void {
  if (width === undefined) image.style.removeProperty("width");
  else image.style.width = `${width}px`;
}

/** Keeps the room a picture would take, so that retrying it does not move the page. */
export function reserveImageRoom(frame: HTMLElement, width: number, height: number): void {
  if (width > 0) frame.style.inlineSize = `${width}px`;
  if (height > 0) frame.style.minBlockSize = `${height}px`;
}

export function clearImageRoom(frame: HTMLElement): void {
  frame.style.removeProperty("inline-size");
  frame.style.removeProperty("min-block-size");
}
