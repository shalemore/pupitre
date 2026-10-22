import type { Settings } from "@shared/settings";
import { createSignal } from "solid-js";
import { desktop } from "@/lib/desktop";

// Settings are owned by the main process and broadcast, including changes made by this window, so every window sees the same data
const [settings, setSettings] = createSignal<Settings>(desktop.getSettings());
desktop.on("settings:changed", setSettings);

export { settings };

export function updateSettings(patch: Partial<Settings>): Promise<void> {
  return desktop.invoke("settings:update", patch);
}
