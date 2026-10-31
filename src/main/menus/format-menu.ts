import type { MenuItemConstructorOptions } from "electron";
import type { AppCommand } from "@shared/desktop-api";
import { shortcutOf, type FormatAction } from "@shared/format-actions";
import { t } from "../i18n";

/**
 * Menu items for formatting actions. The editor's keymap handles the shortcuts, so they are only
 * displayed here; registering them would also fire while typing in other inputs.
 */
export function formatItems(
  actions: readonly FormatAction[],
  send: (command: AppCommand) => void,
): MenuItemConstructorOptions[] {
  return actions.map((action) => {
    const shortcut = shortcutOf(action);
    return {
      label: t().format[action],
      ...(shortcut === undefined ? {} : { accelerator: shortcut, registerAccelerator: false }),
      click: () => send({ id: "format", action }),
    };
  });
}
