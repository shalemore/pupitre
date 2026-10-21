import type { AnimationSetting } from "@/lib/config";

let mediaQueryListener: (() => void) | null = null;

/**
 * Determine whether animations should be reduced based on user setting
 * and system preference (prefers-reduced-motion).
 */
export function shouldReduceMotion(setting: AnimationSetting): boolean {
  if (setting === "off") return true;
  if (setting === "on") return false;

  // "system": follows OS accessibility setting (Windows / macOS / Linux)
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return false;
}

/**
 * Apply motion/animation preference to the document root and CSS variables.
 */
export function applyMotion(setting: AnimationSetting): void {
  if (typeof document === "undefined") return;

  const reduce = shouldReduceMotion(setting);
  document.documentElement.classList.toggle("reduce-motion", reduce);
  document.documentElement.style.setProperty("--app-scroll-behavior", reduce ? "auto" : "smooth");

  // Setup / teardown system preference change listener when in "system" mode
  if (mediaQueryListener) {
    mediaQueryListener();
    mediaQueryListener = null;
  }

  if (setting === "system" && typeof window !== "undefined" && window.matchMedia) {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => {
      const isReduced = e.matches;
      document.documentElement.classList.toggle("reduce-motion", isReduced);
      document.documentElement.style.setProperty(
        "--app-scroll-behavior",
        isReduced ? "auto" : "smooth",
      );
    };
    mq.addEventListener("change", handler);
    mediaQueryListener = () => mq.removeEventListener("change", handler);
  }
}
