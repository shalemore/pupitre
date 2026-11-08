import { createSignal } from "solid-js";
import { desktop } from "@/lib/desktop";

const [recentFiles, setRecentFiles] = createSignal(desktop.initialState.recentFiles);
desktop.on("recent-files:changed", setRecentFiles);

export { recentFiles };
