import { cn } from "cn";
import { Show, type ParentComponent } from "solid-js";
import { desktop } from "@/lib/desktop";
import { CaptionButtons } from "./caption-buttons";

/**
 * The window title bar. It is draggable as a whole and leaves room for the native caption buttons
 * or traffic lights (see .app-title-bar in app.css); the main window on Windows and Linux gets
 * caption buttons drawn here instead.
 */
export const TitleBar: ParentComponent<{ class?: string; inert?: boolean }> = (props) => {
  const side = desktop.initialState.captionSide;
  return (
    <header
      data-caption-buttons={side}
      inert={props.inert}
      class={cn(
        "app-title-bar print:hidden w-full shrink-0 flex items-center gap-2 px-3 select-none bg-surface-0 text-xs",
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
