import { cn } from "cn";
import type { JSX } from "solid-js";
import { t } from "@/i18n";
import { settings, updateSettings } from "@/lib/settings";
import type { Settings } from "@shared/settings";

interface LookOptionProps {
  value: Settings["windowStyle"];
  label: string;
  description: string;
  preview: JSX.Element;
}

const LookOption = (props: LookOptionProps) => {
  const selected = () => settings().windowStyle === props.value;
  return (
    <button
      type="button"
      aria-pressed={selected()}
      onClick={() => void updateSettings({ windowStyle: props.value })}
      class={cn(
        "pressable flex w-48 cursor-pointer flex-col gap-2 rounded-lg border p-2 text-start outline-none focus-visible:shadow-focus",
        selected() ? "border-brand bg-accent" : "border-border hover:bg-accent",
      )}
    >
      {props.preview}
      <span class="px-0.5">
        <span class="block text-xs font-medium text-foreground">{props.label}</span>
        <span class="block text-2xs leading-snug text-muted-foreground">{props.description}</span>
      </span>
    </button>
  );
};

/**
 * Shown on the welcome screen of the first launch only: the immersive window is what sets
 * Pupitre apart, so it is offered next to the classic one before anything else.
 */
export const LookChooser = () => (
  <section class="mb-8 flex flex-col items-center gap-3">
    <h2 class="text-xs font-medium text-muted-foreground">{t().welcome.chooseLook}</h2>
    <div class="flex items-stretch gap-3">
      <LookOption
        value="immersive"
        label={t().settings.windowStyleImmersive}
        description={t().welcome.lookImmersiveDesc}
        preview={
          <div class="h-16 rounded-md bg-surface-0 p-1.5" aria-hidden="true">
            <div class="size-full rounded-sm bg-surface-1 shadow-sm" />
          </div>
        }
      />
      <LookOption
        value="classic"
        label={t().settings.windowStyleClassic}
        description={t().welcome.lookClassicDesc}
        preview={
          <div
            class="flex h-16 flex-col overflow-hidden rounded-md border border-border"
            aria-hidden="true"
          >
            <div class="h-2.5 border-b border-border bg-surface-0" />
            <div class="flex flex-1">
              <div class="w-1/4 border-e border-border bg-surface-0" />
              <div class="flex-1 bg-surface-1" />
            </div>
          </div>
        }
      />
    </div>
    <p class="text-2xs text-tertiary">{t().welcome.lookHint}</p>
  </section>
);
