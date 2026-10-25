import { FilePlus, FolderOpen } from "lucide-solid";
import { For, Show, type Component } from "solid-js";
import { Button, Kbd, ListItem } from "@/components/ui";
import { t } from "@/i18n";
import { desktop, isMacOS } from "@/lib/desktop";
import { fileNameOf } from "@/lib/file";
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
    <div class="h-full flex flex-col items-center justify-center text-center select-none px-4 py-12 animate-in fade-in-0 slide-in-from-bottom-2 duration-sheet ease-enter">
      <img src="./logo.svg" alt="" class="size-14 select-none mb-4 opacity-90 drop-shadow-sm" />

      <h1 class="text-xl font-semibold tracking-tight text-foreground mb-6">
        {t().common.appName}
      </h1>

      <Show when={desktop.initialState.firstRun}>
        <LookChooser />
      </Show>

      <div class="flex items-center gap-3 mb-8">
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
        <div class="w-full max-w-sm flex flex-col gap-0.5 text-start mb-6">
          <span class="text-2xs font-medium text-muted-foreground px-2.5 mb-1">
            {t().menu.openRecent}
          </span>
          <For each={props.recentFiles.slice(0, RECENT_FILES_SHOWN)}>
            {(path) => (
              <ListItem
                onClick={() => props.onOpenRecent(path)}
                title={path}
                class="group justify-between gap-2 ps-2.5"
              >
                <span class="min-w-0 truncate font-medium text-foreground transition-colors group-hover:text-brand">
                  <bdi dir="ltr">{fileNameOf(path)}</bdi>
                </span>
                <span dir="ltr" class="text-2xs font-mono text-tertiary truncate max-w-40">
                  {path}
                </span>
              </ListItem>
            )}
          </For>
        </div>
      </Show>

      <p class="text-2xs text-tertiary">{t().welcome.dragDropHint}</p>
    </div>
  );
};
