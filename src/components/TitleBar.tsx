import { cn } from "cn";
import { Show, type Component } from "solid-js";
import { WindowControls } from "@/components/ui";
import { t } from "@/i18n";
import { isMacOS } from "@/lib/platform";
import { toggleMaximizeCurrentWindow } from "@/lib/window";
import type { AppActionHandlers } from "@/types";
import { MenuBar } from "./MenuBar";

export interface TitleBarProps extends AppActionHandlers {
  fileName: string;
  isDirty: boolean;
  wordsCount: number;
  charsCount: number;
  hasDocument: boolean;
}

export const TitleBar: Component<TitleBarProps> = (props) => {
  return (
    <header
      data-tauri-drag-region
      class={cn(
        "h-10 w-full relative flex items-center justify-between px-3 select-none bg-surface-0 border-b border-border/80 transition-colors text-xs z-30",
        !isMacOS() && "pr-36",
      )}
      onDblClick={toggleMaximizeCurrentWindow}
    >
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2 me-1 pointer-events-none" data-tauri-drag-region>
          <img src="/logo.svg" alt="logo" class="rounded-sm shadow-sm size-4 select-none" />
          <span class="font-semibold text-muted-foreground tracking-wide">
            {t().common.appName}
          </span>
        </div>

        <MenuBar
          onNew={props.onNew}
          onOpen={props.onOpen}
          onOpenRecent={props.onOpenRecent}
          onSave={props.onSave}
          onSaveAs={props.onSaveAs}
          onToggleSidebar={props.onToggleSidebar}
          onToggleTheme={props.onToggleTheme}
          onOpenSettings={props.onOpenSettings}
          onOpenAbout={props.onOpenAbout}
          onOpenSample={props.onOpenSample}
          onFind={props.onFind}
          onReplace={props.onReplace}
          onZoomIn={props.onZoomIn}
          onZoomOut={props.onZoomOut}
          onZoomReset={props.onZoomReset}
          recentFiles={props.recentFiles}
        />
      </div>

      <div
        data-tauri-drag-region
        class="flex-1 flex items-center justify-center text-center font-medium text-foreground pointer-events-auto cursor-default truncate max-w-md px-4"
      >
        <Show when={props.hasDocument && props.fileName}>
          <span class="truncate pointer-events-none">
            {props.isDirty ? "● " : ""}
            {props.fileName}
          </span>
        </Show>
      </div>

      <div class="flex items-center gap-2">
        <Show when={props.hasDocument}>
          <div class="text-[11px] text-muted-foreground font-mono pointer-events-none flex items-center gap-1.5 me-2">
            <span>{t().common.wordsCount(props.wordsCount)}</span>
            <span>·</span>
            <span>{t().common.charsCount(props.charsCount)}</span>
          </div>
        </Show>
      </div>

      <WindowControls class="absolute right-0 top-0" />
    </header>
  );
};
