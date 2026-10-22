import { FilePlus, FolderOpen } from "lucide-solid";
import { For, Show, type Component } from "solid-js";
import { Button } from "@/components/ui";
import { t } from "@/i18n";
import { isMacOS } from "@/lib/desktop";
import { fileNameOf } from "@/lib/file";

interface WelcomeScreenProps {
  recentFiles: readonly string[];
  onNewDocument: () => void;
  onOpenFile: () => void;
  onOpenRecent: (path: string) => void;
}

const modifier = isMacOS ? "⌘" : "Ctrl+";

export const WelcomeScreen: Component<WelcomeScreenProps> = (props) => {
  return (
    <div class="h-full flex flex-col items-center justify-center text-center select-none px-4 py-12 animate-in fade-in-0 duration-(--duration-ui)">
      <img src="./logo.svg" alt="" class="size-14 select-none mb-4 opacity-90 drop-shadow-sm" />

      <h1 class="text-xl font-semibold tracking-tight text-foreground mb-6">
        {t().common.appName}
      </h1>

      <div class="flex items-center gap-3 mb-8">
        <Button variant="brand" onClick={props.onNewDocument}>
          <FilePlus class="size-3.5" />
          <span>{t().actions.newDoc}</span>
          <kbd class="text-[10px] opacity-70 ms-1 font-mono">{modifier}N</kbd>
        </Button>

        <Button variant="outline" onClick={props.onOpenFile}>
          <FolderOpen class="size-3.5" />
          <span>{t().actions.openDoc}</span>
          <kbd class="text-[10px] opacity-70 ms-1 font-mono">{modifier}O</kbd>
        </Button>
      </div>

      <Show when={props.recentFiles.length > 0}>
        <div class="w-full max-w-sm flex flex-col gap-1 text-start mb-6">
          <span class="text-[11px] font-medium text-muted-foreground px-2 mb-1">
            {t().menu.openRecent}
          </span>
          <For each={props.recentFiles.slice(0, 5)}>
            {(path) => (
              <button
                type="button"
                onClick={() => props.onOpenRecent(path)}
                title={path}
                class="w-full px-2.5 py-1.5 rounded-md hover:bg-muted text-start text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors group"
              >
                <span class="truncate font-medium text-foreground group-hover:text-brand">
                  {fileNameOf(path)}
                </span>
                <span
                  dir="ltr"
                  class="text-[10px] font-mono text-muted-foreground truncate max-w-40"
                >
                  {path}
                </span>
              </button>
            )}
          </For>
        </div>
      </Show>

      <p class="text-[11px] text-muted-foreground/60">{t().welcome.dragDropHint}</p>
    </div>
  );
};
