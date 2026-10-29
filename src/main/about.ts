import { app, type BrowserWindow, clipboard } from "electron";
import { choose } from "./dialog-choice";
import { t } from "./i18n";

export function showAboutDialog(window: BrowserWindow): void {
  const labels = t();
  const detail = [
    `${labels.about.versionLabel} ${app.getVersion()}`,
    `Electron: ${process.versions.electron}`,
    `Chromium: ${process.versions.chrome}`,
    `Node.js: ${process.versions.node}`,
    `${labels.about.osLabel} ${process.platform} ${process.arch} ${process.getSystemVersion()}`,
  ].join("\n");
  void choose(
    window,
    { type: "info", title: labels.about.windowTitle, message: app.name, detail },
    [
      { label: labels.dialogs.okButton, value: false },
      { label: labels.dialogs.copyButton, value: true },
    ],
    0,
  ).then((copy) => {
    if (copy === true) void clipboard.writeText(detail);
  });
}
