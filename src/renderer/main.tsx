import "@/app.css";
import { render } from "solid-js/web";
import { setupAppearance } from "@/lib/appearance";
import { MainWindow } from "@/windows/main-window";
import { SettingsWindow } from "@/windows/settings-window";

setupAppearance();

const container = document.getElementById("root");
if (container) {
  render(() => (location.hash === "#settings" ? <SettingsWindow /> : <MainWindow />), container);
}
