import { rmSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { type DraftSession } from "@shared/desktop-api";
import { readDraftSession } from "@shared/draft";
import { readJsonFile, writeJsonFile } from "./json-file";

const DRAFT_FILE = "draft.json";
// The renderer already waits for a pause in the typing; this delay only coalesces the writes that
// still arrive together, such as an auto-save and the draft of the same edit
const WRITE_DELAY = 500;

let pending: DraftSession | undefined;
let timer: NodeJS.Timeout | undefined;

function draftPath(): string {
  return join(app.getPath("userData"), DRAFT_FILE);
}

function cancelPending(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}

/** Writes a draft still waiting for its delay; the process is going away before the delay ends. */
export function flushDraft(): void {
  cancelPending();
  if (pending === undefined) return;
  writeJsonFile(draftPath(), pending);
  pending = undefined;
}

/** The unsaved content of the open tabs, or null when there is none worth restoring. */
export function readDraft(): DraftSession | null {
  const draft = readDraftSession(readJsonFile(draftPath()));
  if (draft !== null) return draft;
  // Nothing the editor wrote reads this way, so the file is a leftover of an interrupted write or
  // of another version; keeping it would only make it fail to restore at every start
  clearDraft();
  return null;
}

/** Keeps the unsaved content of the open tabs; only the last draft before the delay reaches the disk. */
export function writeDraft(session: DraftSession): void {
  pending = session;
  cancelPending();
  timer = setTimeout(flushDraft, WRITE_DELAY);
  // A pending write must not be what keeps a quitting app alive, and flushDraft runs on will-quit
  timer.unref();
}

export function clearDraft(): void {
  pending = undefined;
  cancelPending();
  rmSync(draftPath(), { force: true });
}
