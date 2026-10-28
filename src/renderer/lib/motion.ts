import { settings } from "@/lib/settings";

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

function parseDuration(value: string, fallback: number): number {
  const length = Number.parseFloat(value);
  if (!Number.isFinite(length)) return fallback;
  return value.trim().endsWith("ms") ? length : length * 1000;
}

function parseBezier(value: string): Bezier | undefined {
  const match = /^cubic-bezier\(([^)]+)\)$/.exec(value.trim());
  const points = match?.[1]?.split(",").map(Number);
  if (points?.length !== 4 || points.some((point) => !Number.isFinite(point))) return undefined;
  const [x1, y1, x2, y2] = points;
  if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
    return undefined;
  }
  return { x1, y1, x2, y2 };
}

function bezierValue(a: number, b: number, t: number): number {
  const rest = 1 - t;
  return 3 * rest * rest * t * a + 3 * rest * t * t * b + t * t * t;
}

/** The curve's height at `x`, solving the curve's own x for t first. */
function bezierEase({ x1, y1, x2, y2 }: Bezier, x: number): number {
  let t = x;
  for (let step = 0; step < 8; step++) {
    const error = bezierValue(x1, x2, t) - x;
    if (Math.abs(error) < 1e-5) break;
    const slope = 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
    if (Math.abs(slope) < 1e-6) break;
    t -= error / slope;
  }
  return bezierValue(y1, y2, Math.min(1, Math.max(0, t)));
}

/**
 * The duration and curve a scroll should use. They come from the same tokens as the transitions
 * a theme styles, so a theme changes both the interface and the movement inside it.
 */
export function scrollTiming(): Timing {
  const style = getComputedStyle(document.documentElement);
  const duration = parseDuration(style.getPropertyValue("--transition-duration-sheet"), 300);
  const bezier = parseBezier(style.getPropertyValue("--ease-out-expo"));
  return { duration, ease: bezier ? (t) => bezierEase(bezier, t) : (t) => t };
}
