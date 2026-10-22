import { app, Menu } from "electron";
import { showAboutDialog } from "./about";
import { t } from "./i18n";
import { dispatchToMainWindow, getMainWindow, showSettingsWindow } from "./windows";

/** macOS needs a native application menu; Windows and Linux use the menu bar inside the window. */
export function setupApplicationMenu(): void {
  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(null);
    return;
  }
  const labels = t().menu;
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          {
            label: labels.about,
            click: () => {
              const window = getMainWindow();
              if (window) showAboutDialog(window);
            },
          },
          { type: "separator" },
          { label: labels.preferences, accelerator: "CmdOrCtrl+,", click: showSettingsWindow },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: labels.file,
        submenu: [
          {
            label: labels.newFile,
            accelerator: "CmdOrCtrl+N",
            click: () => dispatchToMainWindow("file.new"),
          },
          {
            label: labels.openFile,
            accelerator: "CmdOrCtrl+O",
            click: () => dispatchToMainWindow("file.open"),
          },
          {
            label: labels.save,
            accelerator: "CmdOrCtrl+S",
            click: () => dispatchToMainWindow("file.save"),
          },
          {
            label: labels.saveAs,
            accelerator: "CmdOrCtrl+Shift+S",
            click: () => dispatchToMainWindow("file.save-as"),
          },
          { label: labels.exportPdf, click: () => dispatchToMainWindow("file.export-pdf") },
          { type: "separator" },
          { role: "close" },
        ],
      },
      { role: "editMenu" },
      { role: "windowMenu" },
    ]),
  );
}
