import { RadioGroup } from "@kobalte/core/radio-group";
import type { JSX } from "solid-js";
import type { Settings } from "@shared/settings";
import { t } from "@/i18n";
import { settings, updateSettings } from "@/lib/settings";

interface LookOptionProps {
  value: Settings["windowStyle"];
  label: string;
  description: string;
  preview: JSX.Element;
}

const LookOption = (props: LookOptionProps) => (
  <RadioGroup.Item
    value={props.value}
    class="pressable flex w-48 cursor-pointer flex-col gap-2 rounded-lg border border-border p-2 text-start outline-none focus-visible:shadow-focus hover:bg-accent data-checked:border-brand data-checked:bg-accent"
  >
    <RadioGroup.ItemInput />
    <RadioGroup.ItemControl>{props.preview}</RadioGroup.ItemControl>
    <RadioGroup.ItemLabel class="px-0.5">
      <span class="block text-xs font-medium text-foreground">{props.label}</span>
      <span class="block text-2xs leading-snug text-muted-foreground">{props.description}</span>
    </RadioGroup.ItemLabel>
  </RadioGroup.Item>
);

/**
 * Shown on the welcome screen of the first launch only: the immersive window is what sets
 * Pupitre apart, so it is offered next to the classic one before anything else.
 */
export const LookChooser = () => (
  <section class="mb-8 flex flex-col items-center gap-3">
    <RadioGroup
      value={settings().windowStyle}
      onChange={(value) => {
        // The group hands back any string; only the two styles the settings hold are worth writing
        if (value === "classic" || value === "immersive")
          void updateSettings({ windowStyle: value });
      }}
      class="flex flex-col items-center gap-3"
    >
      <RadioGroup.Label as="h2" class="text-xs font-medium text-muted-foreground">
        {t().welcome.chooseLook}
      </RadioGroup.Label>
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
    </RadioGroup>
    <p class="text-2xs text-tertiary">{t().welcome.lookHint}</p>
  </section>
);
