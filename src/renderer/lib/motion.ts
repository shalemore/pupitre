import BezierEasing from "bezier-easing";
import { settings } from "@/lib/settings";
import { readToken } from "@/lib/tokens";

/**
 * Whether the interface moves. The setting forces motion on or off; "system" follows the
 * operating system's reduce-motion preference, which the stylesheet also reads.
 */
export function motionEnabled(): boolean {
  const animations = settings().animations;
  if (animations === "on") return true;
  if (animations === "off") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface Bezier {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Timing {
  duration: number;
  ease: (t: number) => number;
}

/** A duration token from the stylesheet in milliseconds, or `fallback` when it cannot be read. */
export function readDuration(value: string, fallback: number): number {
  const length = Number.parseFloat(value);
  if (!Number.isFinite(length)) return fallback;
  const trimmed = value.trim();
  if (trimmed.endsWith("ms")) return length;
  if (trimmed.endsWith("s")) return length * 1000;
  return fallback;
}

function parseBezier(value: string): Bezier | undefined {
  const match = /^cubic-bezier\(([^)]+)\)$/.exec(value.trim());
  const points = match?.[1]?.split(",").map(Number);
  if (points?.length !== 4 || points.some((point) => !Number.isFinite(point))) return undefined;
  const [x1, y1, x2, y2] = points;
  if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
    return undefined;
  }
  // A curve's x controls must lie in [0, 1]. A theme owns the custom property this is read from,
  // and the CSS parser does not validate a value it only stores.
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return undefined;
  return { x1, y1, x2, y2 };
}

/**
 * The duration and curve a scroll should use. They come from the same tokens as the transitions
 * a theme styles, so a theme changes both the interface and the movement inside it.
 */
export function scrollTiming(): Timing {
  const style = getComputedStyle(document.documentElement);
  const duration = readDuration(readToken(style, "transition-duration-sheet"), 300);
  const bezier = parseBezier(readToken(style, "ease-out-expo"));
  return {
    duration,
    ease: bezier ? BezierEasing(bezier.x1, bezier.y1, bezier.x2, bezier.y2) : (t) => t,
  };
}
