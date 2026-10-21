import { render } from "solid-js/web";
import { App } from "@/App";
import "@/app.css";
import { SettingsWindow } from "@/components/Settings/SettingsWindow";
import { isMacOS } from "@/lib/platform";
import { applyTheme } from "@/lib/theme";

// Tag root HTML element with platform attribute for platform-tailored font smoothing and metrics
if (typeof document !== "undefined") {
  document.documentElement.setAttribute("data-platform", isMacOS() ? "macos" : "windows");
}

// Synchronously initialize theme to prevent flash of wrong theme
try {
  const raw = localStorage.getItem("pupitre-config");
  if (raw) {
    const cfg = JSON.parse(raw);
    if (cfg.theme) {
      applyTheme(cfg.theme);
    }
  } else {
    applyTheme("system");
  }
} catch {
  // ignore
}

function isSettingsView(): boolean {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get("view") === "settings") return true;

  if (window.location.hash.includes("settings")) return true;

  if ((window as unknown as { pupitreView?: string }).pupitreView === "settings") {
    return true;
  }

  try {
    const winRecord = window as unknown as Record<string, any>;
    const internals = winRecord["__TAURI_INTERNALS__"];
    if (internals?.metadata?.currentWindow?.label === "settings") {
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}

const root = document.getElementById("root");
if (root) {
  if (isSettingsView()) {
    render(() => <SettingsWindow />, root);
  } else {
    render(() => <App />, root);
  }
}
