import { FilePlus, FolderOpen } from "lucide-solid";
import { For, Show, type Component } from "solid-js";
import { Button } from "@/components/ui";
import { t } from "@/i18n";

interface WelcomeProps {
  onStartWriting: () => void;
  onOpenFile: () => void;
  onOpenRecent?: (path: string) => void;
  recentFiles?: string[];
}

export const Welcome: Component<WelcomeProps> = (props) => {
  return (
    <div class="h-full flex flex-col items-center justify-center text-center select-none px-4 py-12 animate-in fade-in-0 duration-(--duration-ui)">
      <img
        src="./logo.svg"
        alt="Pupitre Logo"
        class="size-14 select-none mb-4 opacity-90 drop-shadow-sm"
      />

      <h1 class="text-xl font-semibold tracking-tight text-foreground mb-6 font-sans">
        {t().common.appName}
      </h1>

      <div class="flex items-center gap-3 mb-8">
        <Button variant="brand" size="default" onClick={props.onStartWriting}>
          <FilePlus class="size-3.5" />
          <span>{t().actions.newDoc}</span>
          <span class="text-[10px] opacity-70 ml-1 font-mono">Ctrl+N</span>
        </Button>

        <Button variant="outline" size="default" onClick={props.onOpenFile}>
          <FolderOpen class="size-3.5" />
          <span>{t().actions.openDoc}</span>
          <span class="text-[10px] opacity-70 ml-1 font-mono">Ctrl+O</span>
        </Button>
      </div>

      <Show when={props.recentFiles && props.recentFiles.length > 0}>
        <div class="w-full max-w-xs flex flex-col gap-1 text-start mb-6">
          <span class="text-[11px] font-medium text-muted-foreground px-2 mb-1">
            {t().menu.openRecent}
          </span>
          <For each={props.recentFiles!.slice(0, 5)}>
            {(path) => {
              const name = path.split(/[\\/]/).pop() || path;
              return (
                <button
                  type="button"
                  onClick={() => props.onOpenRecent?.(path)}
                  class="w-full px-2.5 py-1.5 rounded-md hover:bg-muted text-start text-xs flex items-center justify-between text-muted-foreground hover:text-foreground cursor-pointer transition-colors group"
                >
                  <span class="truncate font-medium text-foreground group-hover:text-brand">
                    {name}
                  </span>
                  <span class="text-[10px] font-mono opacity-50 truncate max-w-30 ml-2">
                    {path}
                  </span>
                </button>
              );
            }}
          </For>
        </div>
      </Show>

      <div class="text-[11px] text-muted-foreground/60">
        <p>{t().welcome.dragDropHint}</p>
      </div>
    </div>
  );
};
