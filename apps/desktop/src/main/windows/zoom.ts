import type { WebContents } from "electron";
import { ZOOM_STEPS, zoomFactor } from "@shared/settings";
import { getSettings, updateSettings } from "../settings/settings-store";

/** The zoom commands a menu entry or a key can ask for. */
export type ZoomCommand = "in" | "out" | "reset";

/** The directions a zoom step takes; resetting has none. */
export type ZoomDirection = Exclude<ZoomCommand, "reset">;

/** Steps the zoom to the next value above or below it, which may be one the steps do not have. */
export function stepZoom(direction: ZoomDirection): void {
  const { zoom } = getSettings();
  const next =
    direction === "in"
      ? ZOOM_STEPS.find((step) => step > zoom)
      : ZOOM_STEPS.findLast((step) => step < zoom);
  if (next !== undefined) updateSettings({ zoom: next });
}

export function resetZoom(): void {
  updateSettings({ zoom: 100 });
}

export function applyZoom(webContents: WebContents): void {
  webContents.setZoomFactor(zoomFactor(getSettings().zoom));
}
