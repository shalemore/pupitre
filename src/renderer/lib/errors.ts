/** What went wrong, from whatever was thrown: an `Error`, or something a library rejected with. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
