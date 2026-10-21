export function isMacOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Macintosh|Mac OS X|MacIntel/i.test(navigator.userAgent || navigator.platform);
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
