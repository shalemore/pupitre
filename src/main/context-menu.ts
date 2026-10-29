import { BrowserWindow, Menu, type MenuItemConstructorOptions, type WebContents } from "electron";
import { CONTEXT_MENU_FORMAT_ACTIONS } from "@shared/format";
import { withGroupSeparators } from "@shared/menu";
import { formatItems } from "./format-menu";
import { t } from "./i18n";

export interface ContextMenuOptions {
  /** Offer inline formatting for editable content (only the document window has an editor). */
  formatting: boolean;
}

/** A menu longer than this pushes the edit actions off the screen on a short list of words. */
const MAX_SUGGESTIONS = 5;

/**
 * The right-click menu: spelling suggestions, inline formatting and the usual edit actions, with
 * their enabled state taken from Chromium's editFlags.
 */
export function setupContextMenu(webContents: WebContents, options: ContextMenuOptions): void {
  webContents.on("context-menu", (_event, params) => {
    const labels = t().menu;
    const { editFlags, misspelledWord } = params;
    const separator: MenuItemConstructorOptions = { type: "separator" };
    const spelling: MenuItemConstructorOptions[] = misspelledWord
      ? [
          ...params.dictionarySuggestions
            .slice(0, MAX_SUGGESTIONS)
            .map((word): MenuItemConstructorOptions => ({
              label: word,
              click: () => webContents.replaceMisspelling(word),
            })),
          ...(params.dictionarySuggestions.length > 0 ? [separator] : []),
          {
            label: labels.addToDictionary,
            click: () => {
              webContents.session.addWordToSpellCheckerDictionary(misspelledWord);
            },
          },
        ]
      : [];
    const formatting =
      options.formatting && params.isEditable && params.formControlType === "none"
        ? formatItems(CONTEXT_MENU_FORMAT_ACTIONS, (command) =>
            webContents.send("app:command", command),
          )
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
    const groups = [spelling, formatting, editItems].filter((group) => group.length > 0);
    if (groups.length === 0) return;
    // The menu belongs to the frame that was right-clicked, not to whichever window has the focus
    const window = BrowserWindow.fromWebContents(webContents);
    Menu.buildFromTemplate(withGroupSeparators(groups, separator)).popup({
      ...(window === null ? {} : { window }),
      ...(params.frame === null ? {} : { frame: params.frame }),
      sourceType: params.menuSourceType,
    });
  });
}
