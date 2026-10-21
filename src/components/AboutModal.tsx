import { Check, Info, X } from "lucide-solid";
import { createSignal, onCleanup, onMount, Show, type Component } from "solid-js";
import { Button } from "@/components/ui";
import { t } from "@/i18n";
import { formatAboutText, getAboutInfo } from "@/lib/about";

export interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: Component<AboutModalProps> = (props) => {
  const [copied, setCopied] = createSignal(false);
  const [position, setPosition] = createSignal<{ x: number; y: number } | null>(null);

  const info = getAboutInfo();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatAboutText(info));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy system info:", err);
    }
  };

  let dialogRef: HTMLDivElement | undefined;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  const handleTitleBarMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();

    if (dialogRef) {
      const rect = dialogRef.getBoundingClientRect();
      dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      setPosition({ x: rect.left, y: rect.top });
    }

    isDragging = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging) return;
      const maxX = Math.max(10, window.innerWidth - 360);
      const maxY = Math.max(10, window.innerHeight - 180);
      const newX = Math.max(10, Math.min(maxX, moveEvent.clientX - dragOffset.x));
      const newY = Math.max(10, Math.min(maxY, moveEvent.clientY - dragOffset.y));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDragging = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!props.isOpen) return;
      if (e.key === "Escape" || e.key === "Enter") {
        props.onClose();
      } else if (e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopy();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const copyLabel = () => t().dialogs.copyButton;
  const okLabel = () => t().dialogs.okButton;

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 pointer-events-auto select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div
          ref={(el) => {
            dialogRef = el;
          }}
          style={
            position()
              ? {
                  position: "fixed",
                  left: `${position()!.x}px`,
                  top: `${position()!.y}px`,
                }
              : undefined
          }
          class={`w-[460px] max-w-[95vw] rounded-2xl bg-surface-2 border border-border shadow-float flex flex-col overflow-hidden text-foreground animate-in fade-in-0 zoom-in-95 duration-(--duration-ui) ease-(--ease-emphasized) ${
            !position() ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" : ""
          }`}
        >
          <div
            onMouseDown={handleTitleBarMouseDown}
            class="h-8 px-3 border-b border-border/60 bg-surface-0 flex items-center justify-between text-xs font-normal cursor-move select-none"
          >
            <span class="text-foreground font-medium">{info.name}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={props.onClose}
              title={t().settings.closeTip}
            >
              <X class="size-3.5" />
            </Button>
          </div>

          <div class="p-6 flex items-start gap-4">
            <div class="size-9 rounded-full bg-brand text-brand-foreground flex items-center justify-center shrink-0 shadow-sm">
              <Info class="size-5 stroke-[2.5]" />
            </div>

            <div class="flex-1 space-y-3 pt-0.5 text-xs">
              <h2 class="text-lg font-semibold tracking-tight text-foreground">{info.name}</h2>

              <div class="space-y-1 font-mono text-[11px] text-muted-foreground leading-relaxed">
                <div>
                  <span class="text-tertiary">{t().about.versionLabel}</span> {info.version}
                </div>
                <div>
                  <span class="text-tertiary">{t().about.dateLabel}</span> {info.date}
                </div>
                <div>
                  <span class="text-tertiary">{t().about.osLabel}</span> {info.os} ({info.platform})
                </div>
                <div>
                  <span class="text-tertiary">{t().about.engineLabel}</span> {info.engine}
                </div>
                <div class="truncate max-w-[340px]" title={info.userAgent}>
                  <span class="text-tertiary">{t().about.userAgentLabel}</span> {info.userAgent}
                </div>
              </div>
            </div>
          </div>

          <div class="px-5 py-3 border-t border-border/60 bg-surface-0 flex items-center justify-end gap-2 text-xs">
            <Button variant="outline" size="sm" onClick={handleCopy} class="min-w-20">
              <Show when={copied()} fallback={<span>{copyLabel()}</span>}>
                <span class="flex items-center justify-center gap-1 text-success font-medium">
                  <Check class="size-3" />
                  {t().common.copied}
                </span>
              </Show>
            </Button>

            <Button variant="brand" size="sm" onClick={props.onClose} class="min-w-20">
              {okLabel()}
            </Button>
          </div>
        </div>
      </div>
    </Show>
  );
};
