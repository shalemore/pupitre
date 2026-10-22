import { cn } from "cn";
import type { ParentComponent } from "solid-js";

/**
 * The window title bar. It is draggable as a whole and leaves room on both sides for the native window buttons and traffic lights, see .app-title-bar in app.css.
 */
export const TitleBar: ParentComponent<{ class?: string }> = (props) => (
  <header
    class={cn(
      "app-title-bar print:hidden h-10 w-full shrink-0 relative flex items-center gap-2 px-3 select-none bg-surface-0 border-b border-border/80 text-xs z-30",
      props.class,
    )}
  >
    {props.children}
  </header>
);
