import { cn } from "cn";
import { Copy, Minus, Square, X } from "lucide-solid";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { t } from "@/i18n";
import { isMacOS } from "@/lib/platform";
import {
  closeCurrentWindow,
  getCurrentAppWindow,
  minimizeCurrentWindow,
  toggleMaximizeCurrentWindow,
} from "@/lib/window";

export interface WindowControlsProps {
  class?: string;
}

export function WindowControls(props: WindowControlsProps) {
  const [isMaximized, setIsMaximized] = createSignal(false);

  onMount(() => {
    let unlisten: (() => void) | null = null;
    getCurrentAppWindow().then((win) => {
      if (!win) return;
      win.isMaximized().then(setIsMaximized);
      win
        .onResized(async () => {
          const max = await win.isMaximized();
          setIsMaximized(max);
        })
        .then((fn) => {
          unlisten = fn;
        });
    });

    onCleanup(() => {
      unlisten?.();
    });
  });

  return (
    <Show when={!isMacOS()}>
      <div
        dir="ltr"
        data-tauri-drag-region="false"
        onMouseDown={(e) => e.stopPropagation()}
        onDblClick={(e) => e.stopPropagation()}
        class={cn("h-10 flex items-center select-none z-30", props.class)}
      >
        <button
          type="button"
          onClick={minimizeCurrentWindow}
          title={t().window.minimize}
          class="w-11 h-10 flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Minus class="size-3.5" />
        </button>
        <button
          type="button"
          onClick={toggleMaximizeCurrentWindow}
          title={isMaximized() ? t().window.restore : t().window.maximize}
          class="w-11 h-10 flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Show when={isMaximized()} fallback={<Square class="size-3" />}>
            <Copy class="size-3" />
          </Show>
        </button>
        <button
          type="button"
          onClick={closeCurrentWindow}
          title={t().window.close}
          class="w-11 h-10 flex items-center justify-center hover:bg-destructive hover:text-white text-muted-foreground transition-colors cursor-pointer"
        >
          <X class="size-4" />
        </button>
      </div>
    </Show>
  );
}
