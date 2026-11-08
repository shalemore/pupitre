/** A CSS duration in milliseconds, or 0 when the value cannot be read. */
export function readDuration(value: string): number {
  const length = Number.parseFloat(value);
  if (!Number.isFinite(length)) return 0;
  const trimmed = value.trim();
  if (trimmed.endsWith("ms")) return length;
  if (trimmed.endsWith("s")) return length * 1000;
  return 0;
}
