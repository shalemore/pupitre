import "@/app.css";
import { ScrollViewPreferencesProvider } from "@pupitre/ui";
import type { JSX } from "solid-js";
import { render } from "solid-js/web";
import { LocaleProvider } from "@/components/locale-provider";
import { setupAppearance } from "@/lib/appearance";
import { settings } from "@/lib/settings";
import { MainWindow } from "@/windows/main-window";

setupAppearance();

// The scrollbar and edge fade are settings of the app; the UI package only knows their shape
const scrollPreferences = () => ({
  scrollbar: settings().scrollbar,
  fade: settings().scrollFade,
});

function Root(props: { children: JSX.Element }) {
  return (
    <LocaleProvider>
      <ScrollViewPreferencesProvider value={scrollPreferences}>
        {props.children}
      </ScrollViewPreferencesProvider>
    </LocaleProvider>
  );
}

const container = document.getElementById("root");
if (container) {
  // The main window is the one that must answer a file opened at launch, so it stays in the entry.
  // The settings window shares little with it and can load its sections when it is first opened.
  if (location.hash === "#settings") {
    void import("@/windows/settings-window").then(({ SettingsWindow }) =>
      render(
        () => (
          <Root>
            <SettingsWindow />
          </Root>
        ),
        container,
      ),
    );
  } else {
    render(
      () => (
        <Root>
          <MainWindow />
        </Root>
      ),
      container,
    );
  }
}
