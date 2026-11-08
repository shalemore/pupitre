import { createSignal } from "solid-js";
import type { WorkspaceState } from "@shared/desktop-api";
import { desktop } from "@/lib/desktop";

// The main process keeps the open folder and which settings are in use, and announces changes
const [workspace, setWorkspace] = createSignal<WorkspaceState>({
  root: null,
  active: false,
  exists: false,
  overrides: [],
});
void desktop.invoke("workspace:get").then(setWorkspace);
desktop.on("workspace:changed", setWorkspace);

export { workspace };
