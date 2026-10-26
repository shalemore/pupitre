/**
 * The top-level menus of the menu bar. Windows and Linux draw them in the title bar, so the host
 * sends their entries to the window; macOS keeps the system menu bar.
 */
export const TOP_MENUS = ["file", "edit", "paragraphMenu", "format", "view", "help"] as const;
export type TopMenu = (typeof TOP_MENUS)[number];

/** A line of a drawn menu: what a menu holds, without the parts only a host understands. */
export type MenuEntry =
  | { type: "separator" }
  | {
      type: "item";
      /** Names the entry for the host that built the menu, which runs it when the entry is picked. */
      id: string;
      label: string;
      /** A second line under the label, such as the full path of a recent file. */
      detail?: string;
      /** The accelerator written the way the platform writes it, e.g. "Ctrl+Shift+L". */
      shortcut?: string;
      enabled?: boolean;
      checked?: boolean;
      submenu?: readonly MenuEntry[];
    };

/** The entries of every top-level menu; the bar shows the menu names from its own dictionary. */
export type Menus = Readonly<Record<TopMenu, readonly MenuEntry[]>>;

/**
 * The names the menus use for a key, written the way the menu bar of Windows and Linux writes them.
 * The items the app writes itself use CmdOrCtrl, while the accelerators Electron gives a role use
 * CommandOrControl or Control, so all three spellings have to be here.
 */
const KEYS: Readonly<Record<string, string>> = {
  CmdOrCtrl: "Ctrl",
  CommandOrControl: "Ctrl",
  Cmd: "Ctrl",
  Ctrl: "Ctrl",
  Control: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
  Plus: "+",
};

/** An Electron accelerator written the way the drawn menu bar shows it. */
export function formatShortcut(accelerator: string): string {
  return accelerator
    .split("+")
    .map((key) => KEYS[key] ?? key)
    .join("+");
}

/** The items of several groups one after another, with one separator between each pair of groups. */
export function withGroupSeparators<T>(groups: readonly (readonly T[])[], separator: T): T[] {
  return groups.flatMap((group, index) => (index === 0 ? group : [separator, ...group]));
}

/** The entries of every top-level menu, given how to make the entries of one; both hosts make them this way. */
export function menusOf(entriesOf: (menu: TopMenu) => readonly MenuEntry[]): Menus {
  return {
    file: entriesOf("file"),
    edit: entriesOf("edit"),
    paragraphMenu: entriesOf("paragraphMenu"),
    format: entriesOf("format"),
    view: entriesOf("view"),
    help: entriesOf("help"),
  };
}
