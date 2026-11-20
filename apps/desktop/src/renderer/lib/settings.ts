import { desktop } from "@pupitre/desktop-api/client";
import type { SettingKey, Settings } from "@pupitre/settings";
import { createSignal } from "solid-js";

// The main process owns the settings and broadcasts every change, including changes made by this
// window, so all windows always render the same values
const [settings, setSettings] = createSignal<Settings>(desktop.initialState.settings);
desktop.on("settings:changed", setSettings);

export { settings };

/** Whether the windows draw the immersive chrome, which folds away while the user works. */
export const isImmersive = () => settings().windowStyle === "immersive";

export function updateSettings(patch: Partial<Settings>): Promise<void> {
  return desktop.invoke("settings:update", patch);
}

/** Writes one setting by its key, with the value the setting itself takes. */
export function updateSetting<K extends SettingKey>(key: K, value: Settings[K]): Promise<void> {
  const patch: Partial<Settings> = {};
  patch[key] = value;
  return updateSettings(patch);
}

export function resetSetting(key: SettingKey): Promise<void> {
  return desktop.invoke("settings:reset", key);
}
