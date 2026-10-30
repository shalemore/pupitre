import { createMemo, createResource, Show } from "solid-js";
import { Kbd } from "@/components/ui";
import { PaletteSheet } from "@/features/palette/palette-sheet";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { dim, shrinkNone, truncateGrow } from "@/lib/styles";
import { commandsFromMenus, filterCommands } from "./commands";

export interface CommandPaletteProps {
  /** Closes the palette; running a command closes it as well. */
  onClose: () => void;
}

/**
 * Every command the menus hold, run through the menu that holds it. The entries are asked for each
 * time the palette opens, because they follow the open document, the settings and the recent files.
 */
export function CommandPalette(props: CommandPaletteProps) {
  const [snapshot] = createResource(() => desktop.invoke("menu:items"));

  const commands = createMemo(() => {
    // A menu that cannot be read lists nothing, which reads the same as no match
    if (snapshot.state !== "ready") return [];
    const menus = snapshot();
    if (menus === undefined) return [];
    const dictionary = t();
    return commandsFromMenus(
      menus,
      (menu) => dictionary.menu[menu],
      dictionary.commandPalette.separator,
    );
  });

  return (
    <PaletteSheet
      title={t().commandPalette.title}
      placeholder={t().commandPalette.placeholder}
      rows={(query) => filterCommands(commands(), query)}
      // Nothing is listed before the menu answers, so an empty list here really is a miss
      emptyMessage={snapshot.state === "ready" ? t().commandPalette.noResults : undefined}
      // The menu runs the entry it holds, exactly as if it had been picked from the menu bar
      onPick={(command) => void desktop.invoke("menu:click", command.id)}
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
            {command.label}
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
