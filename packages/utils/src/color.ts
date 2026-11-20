/** Converts any CSS color (themes mostly use oklch) to #rrggbb, for APIs that only take hex. */
export function toHex(color: string): string {
  const context = new OffscreenCanvas(1, 1).getContext("2d");
  if (!context) return "#000000";
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
  return `#${Uint8Array.of(r, g, b).toHex()}`;
}

/** Whether a #rrggbb color reads as dark: a page or a diagram takes its scheme from the color it sits on. */
export function isDarkColor(hex: string): boolean {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) =>
    Number.parseInt(hex.slice(start, start + 2), 16),
  );
  // Rec. 709 luma: the eye sees green as the brightest of the three, so plain brightness would not do
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}
