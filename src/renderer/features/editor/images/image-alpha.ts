/** The side of the square a picture is sampled at, enough to see a clear background or a hole. */
const SAMPLE_SIDE = 32;

/**
 * An alpha below this reads as a see-through part rather than as an edge. Scaling a picture down
 * blurs its outline into faint alpha on the pixels around it, which is not a hole in the picture.
 */
const CLEAR_ALPHA = 128;

/**
 * Whether a picture has see-through parts, such as an icon or a logo. The picture is drawn small
 * and its pixels looked at; a pixel that is clearly see-through counts.
 *
 * A picture from another origin taints the canvas, and reading its pixels then throws. Such a
 * picture is taken for opaque, which is what a frame around it expects.
 */
export function hasTransparency(image: HTMLImageElement): boolean {
  const width = Math.min(image.naturalWidth, SAMPLE_SIDE);
  const height = Math.min(image.naturalHeight, SAMPLE_SIDE);
  // A picture that has not loaded, or an SVG without a size of its own, has no pixels to read
  if (width === 0 || height === 0) return false;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) return false;
  try {
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    for (let alpha = 3; alpha < pixels.length; alpha += 4) {
      if ((pixels[alpha] ?? 255) < CLEAR_ALPHA) return true;
    }
  } catch {
    return false;
  }
  return false;
}
