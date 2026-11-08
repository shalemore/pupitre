import { resolveLocale } from "@pupitre/i18n";
import { setLocale } from "@pupitre/i18n/solid";
import { createEffect, createRoot } from "solid-js";
import { settings } from "@/lib/settings";

// The language every `t()` reads; the setting and the system's languages decide it, and a change
// of either follows without reloading a window.
createRoot(() => {
  createEffect(() => setLocale(resolveLocale(settings().locale, navigator.languages)));
});
