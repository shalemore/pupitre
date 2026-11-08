import type { PluginDocumentRequest, PluginDocumentResponse } from "@pupitre/desktop-api";
import { sendTo } from "../broadcast";
import { getMainWindow } from "../windows/windows";

/** What a plugin asks the editor, before the bridge gives the request an id. */
export type DocumentRequestInput =
  | { method: "read" }
  | { method: "replace"; text: string }
  | { method: "insert"; text: string }
  | { method: "selection" }
  | { method: "scrollToLine"; line: number };

const TIMEOUT_MS = 5000;

let nextId = 1;
const pending = new Map<
  number,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }
>();

function withId(id: number, input: DocumentRequestInput): PluginDocumentRequest {
  switch (input.method) {
    case "read":
      return { id, method: "read" };
    case "replace":
      return { id, method: "replace", text: input.text };
    case "insert":
      return { id, method: "insert", text: input.text };
    case "selection":
      return { id, method: "selection" };
    case "scrollToLine":
      return { id, method: "scrollToLine", line: input.line };
  }
}

/**
 * Asks the main window's editor for something and waits for its answer. A request no window
 * answers is dropped after a moment, so a plugin cannot hold a handler open forever.
 */
export function requestDocument(input: DocumentRequestInput): Promise<unknown> {
  const window = getMainWindow();
  if (window === undefined) return Promise.reject(new Error("No document window is open"));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("The editor did not answer in time"));
    }, TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    sendTo(window.webContents, "plugin:document-request", withId(id, input));
  });
}

/** The answer from the window, matched to the request that waits for it. */
export function handleDocumentResponse(id: number, response: PluginDocumentResponse): void {
  const entry = pending.get(id);
  if (entry === undefined) return;
  pending.delete(id);
  clearTimeout(entry.timer);
  if (response.ok) entry.resolve(response.value);
  else entry.reject(new Error(response.message));
}
