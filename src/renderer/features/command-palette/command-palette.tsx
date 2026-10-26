import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import type { Menus } from "@shared/menu";
import { Input, Kbd, ListItem, ScrollView } from "@/components/ui";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { commandsFromMenus, filterCommands, type PaletteCommand } from "./commands";

/** The list the input points at, which keeps the list reachable while the input holds the focus. */
const LISTBOX_ID = "command-palette-list";

function optionId(index: number): string {
  return `command-palette-option-${index}`;
}

export interface CommandPaletteProps {
  /** Closes the palette; running a command closes it as well. */
  onClose: () => void;
}

/**
 * Every command the menus hold, run through the menu that holds it. The entries are asked for each
 * time the palette opens, because they follow the open document, the settings and the recent files.
 */
export function CommandPalette(props: CommandPaletteProps) {
  const [snapshot, setSnapshot] = createSignal<Menus>();
  const [query, setQuery] = createSignal("");
  const [wanted, setWanted] = createSignal(0);
  let input: HTMLInputElement | undefined;
  let list: HTMLDivElement | undefined;
  let opener: HTMLElement | undefined;

  const commands = createMemo(() => {
    const menus = snapshot();
    if (menus === undefined) return [];
    const dictionary = t();
    return commandsFromMenus(
      menus,
      (menu) => dictionary.menu[menu],
      dictionary.commandPalette.separator,
    );
  });
  const shown = createMemo(() => filterCommands(commands(), query()));
  // Clamped rather than reset, so a list that narrows under the query never points past its end
  const active = createMemo(() => Math.min(wanted(), Math.max(shown().length - 1, 0)));

  // The highlight follows the list; it has to be seen even when it moved past the port
  createEffect(() => {
    list?.querySelector(`[data-index="${active()}"]`)?.scrollIntoView({ block: "nearest" });
  });

  onMount(() => {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    input?.focus();
    void desktop.invoke("menu:items").then(setSnapshot);
  });
  // Whatever closed the palette, the focus goes back to where it was before
  onCleanup(() => {
    if (opener?.isConnected === true) opener.focus();
  });

  const move = (step: number) => {
    const count = shown().length;
    if (count === 0) return;
    setWanted((active() + step + count) % count);
  };

  const run = (command: PaletteCommand) => {
    // The menu runs the entry it holds, exactly as if it had been picked from the menu bar
    void desktop.invoke("menu:click", command.id);
    props.onClose();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        return move(1);
      case "ArrowUp":
        event.preventDefault();
        return move(-1);
      case "Enter": {
        const command = shown()[active()];
        if (command === undefined) return;
        event.preventDefault();
        return run(command);
      }
      case "Escape":
        event.preventDefault();
        return props.onClose();
      default:
        return;
    }
  };

  return (
    // Outside the window's own tree: the title bar clips its children and the palette covers them
    <Portal>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-surface-0/60 p-4 backdrop-blur-sm animate-in fade-in-0 duration-base"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) props.onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t().commandPalette.title}
          onKeyDown={onKeyDown}
          class="floating-panel flex max-h-full w-full max-w-lg flex-col gap-2 p-2 text-xs animate-in fade-in-0 zoom-in-95 duration-base ease-enter"
        >
          <Input
            ref={(element) => (input = element)}
            value={query()}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setWanted(0);
            }}
            placeholder={t().commandPalette.placeholder}
            aria-label={t().commandPalette.title}
            role="combobox"
            aria-expanded={true}
            aria-controls={LISTBOX_ID}
            aria-autocomplete="list"
            aria-activedescendant={shown().length > 0 ? optionId(active()) : undefined}
          />
          <ScrollView
            ref={(element) => (list = element)}
            id={LISTBOX_ID}
            role="listbox"
            aria-label={t().commandPalette.title}
            class="flex max-h-80 min-h-0 flex-col gap-0.5"
          >
            <For each={shown()}>
              {(command, index) => (
                <ListItem
                  id={optionId(index())}
                  data-index={index()}
                  role="option"
                  aria-selected={index() === active()}
                  active={index() === active()}
                  tabIndex={-1}
                  onPointerEnter={() => setWanted(index())}
                  onClick={() => run(command)}
                  class="gap-3"
                >
                  {/* The path keeps the row's own color, at less weight, so a highlight moves both */}
                  <span class="min-w-0 flex-1 truncate">
                    <span class="opacity-60">
                      {command.parent}
                      {t().commandPalette.separator}
                    </span>
                    {command.label}
                  </span>
                  <Show when={command.shortcut}>
                    {(shortcut) => (
                      <Kbd dir="ltr" class="shrink-0">
                        {shortcut()}
                      </Kbd>
                    )}
                  </Show>
                </ListItem>
              )}
            </For>
          </ScrollView>
          {/* Nothing is listed before the menu answers, so an empty list here really is a miss */}
          <Show when={snapshot() !== undefined && shown().length === 0}>
            <p role="status" class="px-2.5 py-1.5 text-muted-foreground">
              {t().commandPalette.noResults}
            </p>
          </Show>
        </div>
      </div>
    </Portal>
  );
}
