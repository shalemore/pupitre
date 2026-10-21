import { BookOpen, Check, Copy, X } from "lucide-solid";
import { createSignal, onCleanup, onMount, Show, type Component } from "solid-js";
import { Button } from "@/components/ui";
import { setLanguageSetting, t } from "@/i18n";
import { formatAboutText, getAboutInfo } from "@/lib/about";
import { setupConfigSync } from "@/lib/config";
import { isTauri } from "@/lib/platform";
import { applyTheme } from "@/lib/theme";
import { closeCurrentWindow } from "@/lib/window";

export const AboutWindow: Component = () => {
  const [copied, setCopied] = createSignal(false);
  const info = getAboutInfo();

  onMount(() => {
    // Keep theme and language in sync across windows
    const cleanupSync = setupConfigSync((newCfg) => {
      if (newCfg.theme) {
        applyTheme(newCfg.theme);
      }
      if (newCfg.locale) {
        setLanguageSetting(newCfg.locale);
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        closeCurrentWindow();
      } else if (e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopy();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      cleanupSync();
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatAboutText(info));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy system info:", err);
    }
  };

  const handleOpenSampleDoc = async () => {
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const bc = new BroadcastChannel("pupitre-actions");
        // oxlint-disable-next-line unicorn/require-post-message-target-origin
        bc.postMessage({ action: "open-sample" });
        bc.close();
      } catch {
        // ignore
      }
    }

    if (isTauri()) {
      try {
        const { emit } = await import("@tauri-apps/api/event");
        await emit("app-action", "open-sample");
        const { getAllWindows } = await import("@tauri-apps/api/window");
        const allWins = await getAllWindows();
        const mainWin = allWins.find((w) => w.label === "main");
        if (mainWin) {
          await mainWin.unminimize();
          await mainWin.show();
          await mainWin.setFocus();
        }
      } catch (err) {
        console.error("Failed to focus main window for sample doc:", err);
      }
    }
  };

  return (
    <div class="h-screen w-screen flex flex-col bg-surface-1 text-foreground select-none overflow-hidden font-sans border border-border/80">
      {/* Native Drag Region Header */}
      <header
        data-tauri-drag-region
        class="h-9 w-full relative flex items-center justify-between px-3 select-none bg-surface-0 border-b border-border/80 text-xs shrink-0"
      >
        <div class="flex items-center gap-2 pointer-events-none" data-tauri-drag-region>
          <img src="/logo.svg" alt="logo" class="rounded-sm shadow-sm size-4 select-none" />
          <span class="font-medium text-foreground tracking-wide">{info.name}</span>
        </div>

        <button
          type="button"
          onClick={() => closeCurrentWindow()}
          title={t().settings.closeTip}
          class="size-7 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
        >
          <X class="size-3.5" />
        </button>
      </header>

      {/* Main Content */}
      <div class="flex-1 p-5 flex items-start gap-4.5 overflow-hidden">
        <img
          src="/logo.svg"
          alt="Pupitre"
          class="size-12 rounded-xl select-none shadow-sm shrink-0 mt-0.5"
        />

        <div class="flex-1 space-y-3 min-w-0 text-xs">
          <div>
            <h2 class="text-base font-semibold tracking-tight text-foreground">{info.name}</h2>
            <p class="text-[11px] text-muted-foreground mt-0.5">
              Lightweight Markdown & Plain Text Workspace
            </p>
          </div>

          <div class="space-y-1 tabular-nums text-[11px] text-muted-foreground leading-relaxed">
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
            <div class="truncate max-w-75" title={info.userAgent}>
              <span class="text-tertiary">{t().about.userAgentLabel}</span> {info.userAgent}
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <footer class="px-4 py-2.5 border-t border-border/80 bg-surface-0 flex items-center justify-between gap-2 text-xs shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenSampleDoc}
          class="gap-1.5 text-xs"
          title={t().about.sampleDocDesc}
        >
          <BookOpen class="size-3.5" />
          <span>{t().about.openSampleDoc}</span>
        </Button>

        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} class="min-w-20 gap-1.5 text-xs">
            <Show
              when={copied()}
              fallback={
                <>
                  <Copy class="size-3" />
                  <span>{t().dialogs.copyButton}</span>
                </>
              }
            >
              <Check class="size-3 text-success" />
              <span class="text-success font-medium">{t().common.copied}</span>
            </Show>
          </Button>

          <Button
            variant="brand"
            size="sm"
            onClick={() => closeCurrentWindow()}
            class="min-w-16 text-xs"
          >
            {t().dialogs.okButton}
          </Button>
        </div>
      </footer>
    </div>
  );
};
