import type { CaptionSide } from "@pupitre/desktop-api";
import { desktop } from "@pupitre/desktop-api/client";
import { t } from "@pupitre/i18n/solid";
import { cn } from "@pupitre/ui";
import { Copy, Minus, Square, X } from "lucide-solid";
import { createSignal, onCleanup, Show, type Component } from "solid-js";

const buttonBase =
  "interactive flex w-caption-button items-center justify-center text-muted-foreground";

/**
 * Minimize, maximize and close, drawn by the page for the main window on Windows and Linux,
 * where the native buttons could not hide with the title bar. Close goes through the window's
 * close event, so unsaved changes are still asked about.
 */
export const CaptionButtons: Component<{ side: CaptionSide }> = (props) => {
  const [maximized, setMaximized] = createSignal(false);
  onCleanup(desktop.on("window:maximized-changed", setMaximized));
  const labels = () => t().window;

  const close = (
    <button
      type="button"
      aria-label={labels().close}
      title={labels().close}
      onClick={() => void desktop.invoke("window:close")}
      class={cn(buttonBase, "hover:bg-window-close hover:text-window-close-foreground")}
    >
      <X class="size-4" stroke-width={1.25} />
    </button>
  );

  return (
    <div dir="ltr" class="app-no-drag flex h-full shrink-0 items-stretch">
      <Show when={props.side === "left"}>{close}</Show>
      <button
        type="button"
        aria-label={labels().minimize}
        title={labels().minimize}
        onClick={() => void desktop.invoke("window:minimize")}
        class={cn(buttonBase, "hover:bg-accent hover:text-foreground")}
      >
        <Minus class="size-4" stroke-width={1.25} />
      </button>
      <button
        type="button"
        aria-label={maximized() ? labels().restore : labels().maximize}
        title={maximized() ? labels().restore : labels().maximize}
        onClick={() => void desktop.invoke("window:toggle-maximize")}
        class={cn(buttonBase, "hover:bg-accent hover:text-foreground")}
      >
        <Show when={maximized()} fallback={<Square class="size-3.5" stroke-width={1.25} />}>
          <Copy class="size-3.5 -scale-x-100" stroke-width={1.25} />
        </Show>
      </button>
      <Show when={props.side === "right"}>{close}</Show>
    </div>
  );
};
