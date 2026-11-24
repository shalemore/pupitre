import { desktop, isMacOS } from "@pupitre/desktop-api/client";
import { t } from "@pupitre/i18n/solid";
import { Button, Kbd, ListItem, ScrollView } from "@pupitre/ui";
import { fileNameOf } from "@pupitre/utils";
import { FilePlus, FolderOpen } from "lucide-solid";
import { For, Show, type Component } from "solid-js";
import { PUBLIC_LOGO } from "@/lib/public-asset";
import { LookChooser } from "./look-chooser";

interface WelcomeScreenProps {
  recentFiles: readonly string[];
  onNewDocument: () => void;
  onOpenFile: () => void;
  onOpenRecent: (path: string) => void;
}

const modifier = isMacOS ? "⌘" : "Ctrl+";
/** The menus list every recent file; the welcome screen keeps a short reminder of them. */
const RECENT_FILES_SHOWN = 5;

export const WelcomeScreen: Component<WelcomeScreenProps> = (props) => {
  return (
    <ScrollView data-slot="welcome" class="h-full animate-fade-in-sheet px-4 py-12 select-none">
      <div class="flex min-h-full flex-col items-center justify-center text-center">
        <img src={PUBLIC_LOGO} alt="" class="mb-4 size-14 opacity-90 drop-shadow-sm select-none" />

        <h1 class="mb-6 text-xl font-semibold tracking-tight text-foreground">
          {t().common.appName}
        </h1>

        <Show when={desktop.initialState.firstRun}>
          <LookChooser />
        </Show>

        <div class="mb-8 flex flex-wrap items-center justify-center gap-3">
          <Button variant="brand" onClick={props.onNewDocument}>
            <FilePlus class="size-3.5" />
            <span>{t().actions.newDoc}</span>
            <Kbd class="ms-1">{modifier}N</Kbd>
          </Button>

          <Button variant="outline" onClick={props.onOpenFile}>
            <FolderOpen class="size-3.5" />
            <span>{t().actions.openDoc}</span>
            <Kbd class="ms-1">{modifier}O</Kbd>
          </Button>
        </div>

        <Show when={props.recentFiles.length > 0}>
          <div class="mb-6 flex w-full max-w-sm flex-col gap-0.5 text-start">
            <span class="mb-1 px-2.5 text-2xs font-medium text-muted-foreground">
              {t().menu.openRecent}
            </span>
            <For each={props.recentFiles.slice(0, RECENT_FILES_SHOWN)}>
              {(path) => (
                <ListItem
                  onClick={() => props.onOpenRecent(path)}
                  title={path}
                  class="group justify-between gap-2 ps-2.5"
                >
                  <span class="__INTERACTIVE__ min-w-0 truncate font-medium text-foreground group-hover:text-brand">
                    <bdi dir="auto">{fileNameOf(path)}</bdi>
                  </span>
                  <span dir="auto" class="max-w-40 truncate font-mono text-2xs text-tertiary">
                    {path}
                  </span>
                </ListItem>
              )}
            </For>
          </div>
        </Show>

        <p class="text-2xs text-tertiary">{t().welcome.dragDropHint}</p>
      </div>
    </ScrollView>
  );
};
