import { nativeTheme } from "electron";
import { updateSettings } from "./settings-store";

/** Switches between the light and the dark color scheme. */
export function toggleColorScheme(): void {
  updateSettings({ colorScheme: nativeTheme.shouldUseDarkColors ? "light" : "dark" });
}
