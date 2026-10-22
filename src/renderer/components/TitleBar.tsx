import { Show, type Component } from "solid-js";
import { t } from "@/i18n";
import { isMacOS } from "@/lib/desktop";
import { MenuBar } from "./MenuBar";

export interface TitleBarProps {
  fileName: string;
  isDirty: boolean;
  wordsCount: number;
  charsCount: number;
  hasDocument: boolean;
}

export const TitleBar: Component<TitleBarProps> = (props) => {
  return (
    <header class="app-title-bar print:hidden h-10 w-full relative flex items-center justify-between px-3 select-none bg-surface-0 border-b border-border/80 transition-colors text-xs z-30">
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2 me-1 pointer-events-none">
          <img src="./logo.svg" alt="logo" class="rounded-sm shadow-sm size-4 select-none" />
          <span class="font-semibold text-muted-foreground tracking-wide">
            {t().common.appName}
          </span>
        </div>
        <Show when={!isMacOS}>
          <MenuBar />
        </Show>
      </div>

      <div class="flex-1 flex items-center justify-center text-center font-medium text-foreground cursor-default truncate max-w-md px-4">
        <Show when={props.hasDocument && props.fileName}>
          <span class="truncate pointer-events-none">
            {props.isDirty ? "● " : ""}
            {props.fileName}
          </span>
        </Show>
      </div>

      <div class="flex items-center gap-2">
        <Show when={props.hasDocument}>
          <div class="text-[11px] text-muted-foreground tabular-nums pointer-events-none flex items-center gap-1.5 me-2">
            <span>{t().common.wordsCount(props.wordsCount)}</span>
            <span>·</span>
            <span>{t().common.charsCount(props.charsCount)}</span>
          </div>
        </Show>
      </div>
    </header>
  );
};
