import { cn } from "cn";
import { Show, type ParentComponent } from "solid-js";
import { desktop } from "@/lib/desktop";
import { CaptionButtons } from "./caption-buttons";

/**
 * The window title bar. It is draggable as a whole and leaves room for the native caption buttons
 * or traffic lights (see .app-title-bar in app.css); immersive windows on Windows and Linux get
 * caption buttons drawn here instead.
 */
export const TitleBar: ParentComponent<{ class?: string }> = (props) => {
  const side = desktop.initialState.frame.captionButtons;
  return (
    <header
      data-caption-buttons={side}
      class={cn(
        "app-title-bar print:hidden h-10 w-full shrink-0 relative flex items-center gap-2 px-3 select-none bg-surface-0 border-b border-border/80 text-xs z-30",
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
