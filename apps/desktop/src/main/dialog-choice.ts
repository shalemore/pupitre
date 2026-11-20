import { type BrowserWindow, dialog, type MessageBoxOptions } from "electron";

/** One button of a native box whose buttons are the answers: the words on it, and the value read back. */
export interface Answer<T> {
  label: string;
  value: T;
}

/**
 * Shows a native box whose buttons are the answers, and gives back the value of the one pressed.
 * A box the user dismisses reports its cancel button, which is the last one unless named otherwise.
 */
export async function choose<T>(
  window: BrowserWindow,
  box: Pick<MessageBoxOptions, "type" | "title" | "message" | "detail" | "defaultId">,
  answers: readonly Answer<T>[],
  cancelIndex = answers.length - 1,
): Promise<T | undefined> {
  const { response } = await dialog.showMessageBox(window, {
    ...box,
    buttons: answers.map((answer) => answer.label),
    defaultId: box.defaultId ?? 0,
    cancelId: cancelIndex,
    noLink: true,
  });
  return answers[response]?.value;
}
