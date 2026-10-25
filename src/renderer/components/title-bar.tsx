import { cn } from "cn";
import { Show, type ParentComponent } from "solid-js";
import { desktop } from "@/lib/desktop";
import { CaptionButtons } from "./caption-buttons";

/**
 * The window title bar. It is draggable as a whole and leaves room for the native caption buttons
 * or traffic lights (see .app-title-bar in app.css); the main window on Windows and Linux gets
 * caption buttons drawn here instead. Its 40px height is the one the main process gives the
 * native buttons and the traffic lights, TITLE_BAR_HEIGHT in src/main/windows.ts.
 */
export const TitleBar: ParentComponent<{ class?: string; inert?: boolean }> = (props) => {
  const side = desktop.initialState.captionSide;
  return (
    <header
      // The caption buttons stay on the window's physical side in every language, so the bar keeps one order; its texts follow their own script
      dir="ltr"
      data-caption-buttons={side}
      inert={props.inert}
      class={cn(
        // The horizontal padding comes from .app-title-bar, which leaves room for the caption buttons
        "app-title-bar print:hidden w-full h-10 shrink-0 flex items-center gap-2 select-none bg-surface-0 text-xs",
        props.class,
      )}
    >
      <Show when={side === "left"}>
        <CaptionButtons side="left" />
      </Show>
      {props.children}
      <Show when={side === "right"}>
        <CaptionButtons side="right" />
      </Show>
    </header>
  );
};
