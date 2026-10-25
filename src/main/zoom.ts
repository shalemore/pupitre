import type { WebContents } from "electron";
import { ZOOM_STEPS, zoomFactor } from "@shared/settings";
import { getSettings, updateSettings } from "./settings-store";

/** Steps the zoom to the next value above or below it, which may be one the steps do not have. */
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
  webContents.setZoomFactor(zoomFactor(getSettings().zoom));
}
