/** Whether a value is a JSON-like object: not null, not an array, and not a primitive. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
