import { desktop } from "@/lib/desktop";

/** What went wrong, from whatever was thrown: an `Error`, or something a library rejected with. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Tells the user in a dialog that an action failed, with what it failed on under the title. */
export async function reportFailure(title: string, ...detail: readonly string[]): Promise<void> {
  await desktop.invoke("dialog:show-error", title, detail.join("\n\n"));
}
