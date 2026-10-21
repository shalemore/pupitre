import { isTauri } from "@/lib/platform";

/**
 * Batch update the enabled state of native menu items (e.g. on macOS).
 * Keeps desktop native menus synchronized with the reactive application state.
 */
export async function syncNativeMenuItems(states: Record<string, boolean>): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_menu_items_enabled", { items: states });
  } catch (err) {
    console.warn("Failed to synchronize native menu states:", err);
  }
}

