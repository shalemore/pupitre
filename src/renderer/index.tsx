import { createEffect, createRoot } from "solid-js";
import { render } from "solid-js/web";
import { App } from "@/App";
import "@/app.css";
import { SettingsWindow } from "@/components/Settings/SettingsWindow";
import { currentDirection, currentLocale } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { settings } from "@/lib/settings";

const root = document.documentElement;
root.dataset["platform"] = desktop.platform;

createRoot(() => {
  createEffect(() => {
    root.lang = currentLocale();
    root.dir = currentDirection();
  });
  createEffect(() => {
    root.dataset["motion"] = settings().animations;
  });
});

const container = document.getElementById("root");
if (container) {
  render(() => (location.hash === "#settings" ? <SettingsWindow /> : <App />), container);
}
