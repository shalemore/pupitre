import type { SurfaceReadyMessage, SurfaceTheme } from "@pupitre/plugin-sdk";
import { toHex } from "@pupitre/utils";
import { motionEnabled } from "./motion";
import { readToken, type TokenName } from "./tokens";

function color(root: CSSStyleDeclaration, name: TokenName): string {
  const value = readToken(root, name);
  if (value === "") return "#000000";
  try {
    return toHex(value);
  } catch {
    return value;
  }
}

/**
 * The colors a canvas can draw with, taken from the theme the window is showing. A plugin surface
 * has no DOM of its own to inherit from, so this is what it receives instead.
 */
export function surfaceTheme(): SurfaceTheme {
  const root = getComputedStyle(document.documentElement);
  return {
    mode: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    colors: {
      background: color(root, "ui-surface-1"),
      surface: color(root, "ui-surface-0"),
      text: color(root, "ui-text-primary"),
      muted: color(root, "ui-text-secondary"),
      faint: color(root, "ui-text-muted"),
      brand: color(root, "ui-brand"),
      danger: color(root, "ui-danger"),
    },
    reducedMotion: !motionEnabled(),
  };
}

export function isSurfaceReady(value: unknown): value is SurfaceReadyMessage {
  if (typeof value !== "object" || value === null) return false;
  if (!("channel" in value) || value.channel !== "pupitre:surface") return false;
  if (!("type" in value) || value.type !== "ready") return false;
  return "kind" in value && (value.kind === "background" || value.kind === "pointer");
}
