import { desktop } from "@pupitre/desktop-api/client";
import { currentLocale, t } from "@pupitre/i18n/solid";
import { Kbd } from "@pupitre/ui";
import { dim, shrinkNone, truncateGrow } from "@pupitre/ui/styles";
import { createMemo, createResource, onMount, Show } from "solid-js";
import { PaletteSheet } from "@/components/palette-sheet";
import { loadPlugins, plugins } from "@/lib/plugins";
import { commandsFromMenus, filterCommands, pluginCommands, type PaletteCommand } from "./commands";

export interface CommandPaletteProps {
  /** Closes the palette; running a command closes it as well. */
  onClose: () => void;
}

/**
 * Every command the menus hold, run through the menu that holds it. The entries are asked for each
 * time the palette opens, because they follow the open document, the settings and the recent files.
 */
export function CommandPalette(props: CommandPaletteProps) {
  onMount(loadPlugins);
  const [snapshot] = createResource(() => desktop.invoke("menu:items"));

  const commands = createMemo(() => {
    // A menu that cannot be read lists nothing, which reads the same as no match
    if (snapshot.state !== "ready") return [];
    const menus = snapshot();
    if (menus === undefined) return [];
    const dictionary = t();
    return [
      ...commandsFromMenus(
        menus,
        (menu) => dictionary.menu[menu],
        dictionary.commandPalette.separator,
      ),
      ...pluginCommands(plugins(), currentLocale()),
    ];
  });

  const run = (command: PaletteCommand) => {
    if (command.kind === "plugin") {
      void desktop.invoke("plugins:run-command", command.pluginId, command.id);
    } else {
      // The menu runs the entry it holds, exactly as if it had been picked from the menu bar
      void desktop.invoke("menu:click", command.id);
    }
  };

  return (
    <PaletteSheet
      title={t().commandPalette.title}
      placeholder={t().commandPalette.placeholder}
      rows={(query) => filterCommands(commands(), query)}
      // Nothing is listed before the menu answers, so an empty list here really is a miss
      emptyMessage={snapshot.state === "ready" ? t().commandPalette.noResults : undefined}
      onPick={run}
      onClose={props.onClose}
    >
      {(command) => (
        <>
          {/* The path keeps the row's own color, at less weight, so a highlight moves both */}
          <span class={truncateGrow}>
            <span class={dim}>
              {command.parent}
              {t().commandPalette.separator}
            </span>
            <bdi dir="auto">{command.label}</bdi>
          </span>
          <Show when={command.shortcut}>
            {(shortcut) => (
              <Kbd dir="ltr" class={shrinkNone}>
                {shortcut()}
              </Kbd>
            )}
          </Show>
        </>
      )}
    </PaletteSheet>
  );
}
