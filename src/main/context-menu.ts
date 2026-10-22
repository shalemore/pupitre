import { Menu, type MenuItemConstructorOptions, type WebContents } from "electron";
import { t } from "./i18n";

/** The context menu: spelling suggestions plus the usual edit actions, with enabled state taken from Chromium's editFlags. */
export function setupContextMenu(webContents: WebContents): void {
  webContents.on("context-menu", (_event, params) => {
    const labels = t().menu;
    const { editFlags } = params;
    const suggestions = params.dictionarySuggestions.map((word): MenuItemConstructorOptions => ({
      label: word,
      click: () => webContents.replaceMisspelling(word),
    }));
    const editItems: MenuItemConstructorOptions[] = params.isEditable
      ? [
          { label: labels.cut, role: "cut", enabled: editFlags.canCut },
          { label: labels.copy, role: "copy", enabled: editFlags.canCopy },
          { label: labels.paste, role: "paste", enabled: editFlags.canPaste },
          { label: labels.pastePlain, role: "pasteAndMatchStyle", enabled: editFlags.canPaste },
          { type: "separator" },
          { label: labels.selectAll, role: "selectAll", enabled: editFlags.canSelectAll },
        ]
      : params.selectionText.trim()
        ? [{ label: labels.copy, role: "copy" }]
        : [];
    const template =
      suggestions.length > 0
        ? [...suggestions, { type: "separator" as const }, ...editItems]
        : editItems;
    if (template.length > 0) Menu.buildFromTemplate(template).popup();
  });
}
