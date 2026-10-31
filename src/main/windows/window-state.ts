import { rmSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { z } from "zod";
import { createDebouncedTask } from "../debounced-task";
import { readJsonFile, writeJsonFile } from "../json-file";

const WINDOW_STATE_FILE = "window-state.json";
// Moving or resizing the sidebar fires a dozen events a second; only where it settles is worth writing
const WRITE_DELAY = 400;

/**
 * What the main window remembers itself. Electron keeps the bounds and the display mode of the
 * window named "main"; the sidebar widths and the folder the folder sidebar showed are the app's
 * own. Parsing is lenient, so a file an older version wrote with bounds in it still gives back its
 * sidebars.
 */
const windowStateSchema = z.object({
  sidebar: z.strictObject({ start: z.number(), end: z.number() }).optional(),
  folder: z.string().optional(),
});

export type WindowState = z.infer<typeof windowStateSchema>;

// What a window that has never been saved starts from: the schema's own defaults
const FRESH_STATE: WindowState = windowStateSchema.parse({});

let state: WindowState | undefined;
let loaded = false;
let dirty = false;

function statePath(): string {
  return join(app.getPath("userData"), WINDOW_STATE_FILE);
}

function load(): WindowState | undefined {
  const parsed = windowStateSchema.safeParse(readJsonFile(statePath()));
  if (parsed.success) return parsed.data;
  // Nothing the app wrote reads this way, so the file is left over from a write that was cut short
  // or from another version; keeping it would only make it fail at every start
  rmSync(statePath(), { force: true });
  return undefined;
}

/** Where the window was last closed; undefined until a run has recorded anything about it. */
export function readWindowState(): WindowState | undefined {
  if (!loaded) {
    loaded = true;
    state = load();
  }
  return state;
}

const writeStateLater = createDebouncedTask(
  () => {
    if (!dirty || state === undefined) return;
    writeJsonFile(statePath(), state);
    dirty = false;
  },
  WRITE_DELAY,
  { unref: true },
);

/** Writes the window state still waiting for its delay: the window closed or the app is quitting before it ends. */
export function flushWindowState(): void {
  writeStateLater.flush();
}

/** Remembers part of the window for the next run; the file follows once the window settles. */
export function updateWindowState(patch: Partial<WindowState>): void {
  state = { ...(readWindowState() ?? FRESH_STATE), ...patch };
  dirty = true;
  writeStateLater.schedule();
}
