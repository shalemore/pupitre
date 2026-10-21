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

const root = document.getElementById("root");
if (root) {
  const params = new URLSearchParams(window.location.search);
  const isSettings = params.get("view") === "settings";

  if (isSettings) {
    render(() => <SettingsWindow />, root);
  } else {
    render(() => <App />, root);
  }
}
