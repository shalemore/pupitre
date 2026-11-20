import type { PluginInfo } from "@pupitre/desktop-api";
import { TOP_MENUS, type MenuEntry, type Menus, type TopMenu } from "@pupitre/desktop-api/menu";
import { localize } from "@pupitre/plugin-sdk";
import { matchRanges } from "@/lib/fuzzy";

/** One entry of the palette: something a menu or a plugin runs, with the menus it lives under. */
export type PaletteCommand =
  | {
      kind: "menu";
      /** The id the menu holds for the entry, which the host runs when it is picked. */
      id: string;
      label: string;
      /** The names of the menus the entry lives under, outermost first, as in "File › Open Recent". */
      parent: string;
      shortcut: string | undefined;
    }
  | {
      kind: "plugin";
      pluginId: string;
      id: string;
      label: string;
      parent: string;
      shortcut: string | undefined;
    };

/**
 * The commands the menus hold, in menu order: every entry that runs something, under the names of
 * the menus it lives in. Nothing is registered twice: the menus stay the one list of commands.
 */
export function commandsFromMenus(
  menus: Menus,
  labelOf: (menu: TopMenu) => string,
  separator: string,
): PaletteCommand[] {
  const commands: PaletteCommand[] = [];
  const collect = (entries: readonly MenuEntry[], parents: readonly string[]) => {
    for (const entry of entries) {
      // A separator is a line rather than something to run, and an entry the menu bar disables is
      // one that does nothing from here either; what a skipped entry holds goes with it
      if (entry.type === "separator" || entry.enabled === false) continue;
      const path = [...parents, entry.label];
      if (entry.submenu !== undefined) {
        collect(entry.submenu, path);
        continue;
      }
      commands.push({
        kind: "menu",
        id: entry.id,
        label: entry.label,
        parent: parents.join(separator),
        shortcut: entry.shortcut,
      });
    }
  };
  for (const menu of TOP_MENUS) collect(menus[menu], [labelOf(menu)]);
  return commands;
}

/** The commands running plugins offered, under the plugin's own name. */
export function pluginCommands(plugins: readonly PluginInfo[], locale: string): PaletteCommand[] {
  const commands: PaletteCommand[] = [];
  for (const plugin of plugins) {
    if (!plugin.enabled || plugin.commands === undefined) continue;
    const parent = localize(plugin.manifest.name, locale);
    for (const command of plugin.commands) {
      commands.push({
        kind: "plugin",
        pluginId: plugin.id,
        id: command.id,
        label: localize(command.title, locale),
        parent,
        shortcut: undefined,
      });
    }
  }
  return commands;
}

/**
 * The commands a typed query picks, in menu order. Matching ignores case and accepts a
 * subsequence, so "tsb" finds "Toggle Sidebars"; the shortcut is text like the rest, so "ctrl+l"
 * finds what is bound to it. Nothing typed lists everything.
 */
export function filterCommands(
  commands: readonly PaletteCommand[],
  query: string,
): PaletteCommand[] {
  const needle = query.trim();
  if (needle === "") return [...commands];
  return commands.filter((command) => {
    const text = `${command.label} ${command.parent} ${command.shortcut ?? ""}`;
    return matchRanges(text, needle) !== undefined;
  });
}
