import { desktop } from "@pupitre/desktop-api/client";
import { createSignal } from "solid-js";

const [recentFiles, setRecentFiles] = createSignal(desktop.initialState.recentFiles);
desktop.on("recent-files:changed", setRecentFiles);

export { recentFiles };
