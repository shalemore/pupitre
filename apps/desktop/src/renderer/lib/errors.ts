import { desktop } from "@/lib/desktop";

/** Tells the user in a dialog that an action failed, with what it failed on under the title. */
export async function reportFailure(title: string, ...detail: readonly string[]): Promise<void> {
  await desktop.invoke("dialog:show-error", title, detail.join("\n\n"));
}
