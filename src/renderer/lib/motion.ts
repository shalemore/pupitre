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
