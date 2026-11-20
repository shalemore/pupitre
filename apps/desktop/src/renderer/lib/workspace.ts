import type { WorkspaceState } from "@pupitre/desktop-api";
import { desktop } from "@pupitre/desktop-api/client";
import { createSignal } from "solid-js";

// The main process keeps the open folder and which settings are in use, and announces changes
const [workspace, setWorkspace] = createSignal<WorkspaceState>({
  root: null,
  active: false,
  exists: false,
  settingsPath: null,
  overrides: [],
});
void desktop.invoke("workspace:get").then(setWorkspace);
desktop.on("workspace:changed", setWorkspace);

export { workspace };
