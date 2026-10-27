import "@/app.css";
import { render } from "solid-js/web";
import { setupAppearance } from "@/lib/appearance";
import { MainWindow } from "@/windows/main-window";

setupAppearance();

const container = document.getElementById("root");
if (container) {
  // The main window is the one that must answer a file opened at launch, so it stays in the entry.
  // The settings window shares little with it and can load its sections when it is first opened.
  if (location.hash === "#settings") {
    void import("@/windows/settings-window").then(({ SettingsWindow }) =>
      render(() => <SettingsWindow />, container),
    );
  } else {
    render(() => <MainWindow />, container);
  }
}
