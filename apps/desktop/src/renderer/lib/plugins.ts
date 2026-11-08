import type { PluginInfo } from "@pupitre/desktop-api";
import { desktop } from "@pupitre/desktop-api/client";
import { createSignal } from "solid-js";

// The main process owns the installed plugins and broadcasts every change, so every window shows
// the same list without asking again
const [plugins, setPlugins] = createSignal<readonly PluginInfo[]>([]);
desktop.on("plugins:changed", setPlugins);

export { plugins };

/** Reads the plugins once; `plugins:changed` keeps the list current afterwards. */
export function loadPlugins(): void {
  void desktop.invoke("plugins:list").then(setPlugins, () => setPlugins([]));
}
