import type { SettingKey, Settings } from "@shared/settings";
import { createSignal } from "solid-js";
import { desktop } from "@/lib/desktop";

// The main process owns the settings and broadcasts every change, including changes made by this
// window, so all windows always render the same values
const [settings, setSettings] = createSignal<Settings>(desktop.initialState.settings);
desktop.on("settings:changed", setSettings);

export { settings };

export function updateSettings(patch: Partial<Settings>): Promise<void> {
  return desktop.invoke("settings:update", patch);
}

export function resetSetting(key: SettingKey): Promise<void> {
  return desktop.invoke("settings:reset", key);
}
