import type { WebContents } from "electron";
import { getSettings, updateSettings } from "./settings-store";

/** What Ctrl+plus, Ctrl+minus and Ctrl+wheel step through, the way a browser does; a zoom set elsewhere is stepped from where it is. */
const ZOOM_STEPS = [50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300];

export function stepZoom(direction: "in" | "out"): void {
  const { zoom } = getSettings();
  const next =
    direction === "in"
      ? ZOOM_STEPS.find((step) => step > zoom)
      : ZOOM_STEPS.findLast((step) => step < zoom);
  if (next !== undefined) void updateSettings({ zoom: next });
}

export function resetZoom(): void {
  void updateSettings({ zoom: 100 });
}

export function applyZoom(webContents: WebContents): void {
  webContents.setZoomFactor(getSettings().zoom / 100);
}
