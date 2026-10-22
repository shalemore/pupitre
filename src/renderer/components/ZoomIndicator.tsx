import { Minus, Plus, RotateCcw, ZoomIn } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { Button } from "@/components/ui";

export interface ZoomIndicatorProps {
  zoom: number; // 0.5 to 2.5 (e.g. 1.0 for 100%)
  visible: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function ZoomIndicator(props: ZoomIndicatorProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  const percentage = () => Math.round(props.zoom * 100);

  return (
    <Show when={props.visible || isHovered()}>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-slot="zoom-hud"
        class="fixed bottom-5 right-6 z-40 flex items-center gap-1 rounded-full border border-border/80 bg-surface-2/95 px-2 py-1 text-xs text-foreground shadow-float backdrop-blur-md transition-all animate-in fade-in-0 slide-in-from-bottom-2 duration-(--duration-ui) select-none"
      >
        <button
          type="button"
          onClick={props.onReset}
          class="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full hover:bg-muted font-medium text-brand cursor-pointer transition-colors"
          title="Reset Zoom (Ctrl+0)"
        >
          <ZoomIn class="size-3.5 text-muted-foreground" />
          <span class="font-mono text-[11px]">{percentage()}%</span>
        </button>

        <div class="h-3 w-px bg-border/60 mx-0.5" />

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={props.onZoomOut}
          disabled={props.zoom <= 0.5}
          title="Zoom Out (Ctrl+-)"
          class="rounded-full size-5"
        >
          <Minus class="size-3" />
        </Button>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={props.onZoomIn}
          disabled={props.zoom >= 2.5}
          title="Zoom In (Ctrl++)"
          class="rounded-full size-5"
        >
          <Plus class="size-3" />
        </Button>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={props.onReset}
          title="Reset Zoom (Ctrl+0)"
          class="rounded-full size-5 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw class="size-2.5" />
        </Button>
      </div>
    </Show>
  );
}
