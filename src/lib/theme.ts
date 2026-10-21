/**
 * Theme management for light, dark, and system-adaptive modes.
 * Handles 'system', 'light', and 'dark' states and system preference listeners.
 */

export type ThemeMode = "system" | "light" | "dark";

export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: ThemeMode): boolean {
  if (typeof document === "undefined") return false;
  const isDark = theme === "system" ? getSystemTheme() === "dark" : theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  return isDark;
}

export function listenSystemTheme(onChange: (isDark: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => {
    onChange(e.matches);
  };
  mediaQuery.addEventListener("change", handler);
  return () => mediaQuery.removeEventListener("change", handler);
}
