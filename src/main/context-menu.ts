import { Menu, type MenuItemConstructorOptions, type WebContents } from "electron";
import { INLINE_FORMAT_ACTIONS } from "@shared/format";
import { t } from "./i18n";
import { formatItems } from "./format-menu";

export interface ContextMenuOptions {
  /** Offer inline formatting for editable content (only the document window has an editor). */
  formatting: boolean;
}

/**
 * The right-click menu: spelling suggestions, inline formatting and the usual edit actions, with
 * their enabled state taken from Chromium's editFlags.
 */
export function setupContextMenu(webContents: WebContents, options: ContextMenuOptions): void {
  webContents.on("context-menu", (_event, params) => {
    const labels = t().menu;
    const { editFlags } = params;
    const separator: MenuItemConstructorOptions = { type: "separator" };
    const suggestions = params.dictionarySuggestions.map((word): MenuItemConstructorOptions => ({
      label: word,
      click: () => webContents.replaceMisspelling(word),
    }));
    const formatting =
      options.formatting && params.isEditable && params.formControlType === "none"
        ? formatItems(INLINE_FORMAT_ACTIONS, (command) => webContents.send("app:command", command))
        : [];
    const editItems: MenuItemConstructorOptions[] = params.isEditable
      ? [
          { label: labels.cut, role: "cut", enabled: editFlags.canCut },
          { label: labels.copy, role: "copy", enabled: editFlags.canCopy },
          { label: labels.paste, role: "paste", enabled: editFlags.canPaste },
          { label: labels.pastePlain, role: "pasteAndMatchStyle", enabled: editFlags.canPaste },
          separator,
          { label: labels.selectAll, role: "selectAll", enabled: editFlags.canSelectAll },
        ]
      : params.selectionText.trim()
        ? [{ label: labels.copy, role: "copy" }]
        : [];
    const groups = [suggestions, formatting, editItems].filter((group) => group.length > 0);
    if (groups.length === 0) return;
    const template = groups.flatMap((group, index) =>
      index === 0 ? group : [separator].concat(group),
    );
    Menu.buildFromTemplate(template).popup();
  });
}
