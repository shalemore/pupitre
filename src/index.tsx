import { render } from "solid-js/web";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { App } from "@/App";
import "@/app.css";
import { AboutWindow } from "@/components/About/AboutWindow";
import { SettingsWindow } from "@/components/Settings/SettingsWindow";
import { isMacOS, isTauri } from "@/lib/platform";
import { applyTheme } from "@/lib/theme";
import { applyMotion } from "@/lib/motion";

// Tag root HTML element with platform attribute for platform-tailored font smoothing and metrics
if (typeof document !== "undefined") {
  document.documentElement.setAttribute("data-platform", isMacOS() ? "macos" : "windows");
}

// Synchronously initialize theme and motion to prevent flash of wrong theme/transitions
try {
  const raw = localStorage.getItem("pupitre-config");
  if (raw) {
    const cfg = JSON.parse(raw);
    if (cfg.theme) {
      applyTheme(cfg.theme);
    }
    if (cfg.animations) {
      applyMotion(cfg.animations);
    }
  } else {
    applyTheme("system");
    applyMotion("system");
  }
} catch {
  // ignore
}

function isAboutView(): boolean {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get("view") === "about" || window.location.hash.includes("about")) {
    return true;
  }

  if (isTauri()) {
    return getCurrentWindow().label === "about";
  }

  return false;
}

function isSettingsView(): boolean {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get("view") === "settings" || window.location.hash.includes("settings")) {
    return true;
  }

  if (isTauri()) {
    return getCurrentWindow().label === "settings";
  }

  return false;
}

const root = document.getElementById("root");
if (root) {
  if (isAboutView()) {
    render(() => <AboutWindow />, root);
  } else if (isSettingsView()) {
    render(() => <SettingsWindow />, root);
  } else {
    render(() => <App />, root);
  }
}
