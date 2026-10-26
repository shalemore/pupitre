import { app, type BrowserWindow, clipboard, dialog } from "electron";
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
  void dialog
    .showMessageBox(window, {
      type: "info",
      title: labels.about.windowTitle,
      message: app.name,
      detail,
      buttons: [labels.dialogs.okButton, labels.dialogs.copyButton],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    })
    .then(({ response }) => {
      if (response === 1) void clipboard.writeText(detail);
    });
}
