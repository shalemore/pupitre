import { Check, Languages } from "lucide-solid";
import { createSignal, For, Show, type Component } from "solid-js";
import { Button, Separator } from "@/components/ui";
import {
  currentLocale,
  detectSystemLocale,
  languageSetting,
  type LanguageSetting,
  setLanguageSetting,
  SUPPORTED_LOCALES,
  t,
} from "@/i18n";
import { useClickOutside } from "@/lib/dom";

export const LanguageSelector: Component = () => {
  const [isOpen, setIsOpen] = createSignal(false);
  let containerRef: HTMLDivElement | null = null;

  useClickOutside(
    () => containerRef,
    () => setIsOpen(false),
  );

  const handleSelect = (setting: LanguageSetting) => {
    setLanguageSetting(setting);
    setIsOpen(false);
  };

  const detectedLocaleLabel = () => {
    const code = detectSystemLocale();
    const item = SUPPORTED_LOCALES.find((l) => l.code === code);
    return item ? item.label : "English";
  };

  return (
    <div ref={(el) => (containerRef = el)} class="relative">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => setIsOpen((prev) => !prev)}
        title={t().shortcuts.switchLangTip}
        aria-label={t().shortcuts.switchLangTip}
      >
        <Languages class="size-3.5" />
      </Button>

      <Show when={isOpen()}>
        <div class="absolute inset-e-0 top-full mt-1.5 w-44 py-1 rounded-xl border border-border/80 bg-surface-2 shadow-float text-xs z-50 select-none animate-in fade-in-0 zoom-in-95 duration-(--duration-ui) ease-(--ease-emphasized)">
          <button
            type="button"
            onClick={() => handleSelect("auto")}
            class={`w-full px-2.5 py-1.5 flex items-center justify-between text-start transition-colors cursor-pointer hover:bg-accent hover:text-foreground ${
              languageSetting() === "auto" ? "text-brand font-semibold" : "text-muted-foreground"
            }`}
          >
            <div class="flex flex-col">
              <span>{t().settings.followSystem}</span>
              <span class="text-[10px] text-tertiary font-normal">({detectedLocaleLabel()})</span>
            </div>
            <Show when={languageSetting() === "auto"}>
              <Check class="size-3 text-brand" />
            </Show>
          </button>

          <Separator class="my-1" />

          <div class="max-h-64 overflow-y-auto py-0.5">
            <For each={SUPPORTED_LOCALES}>
              {(locale) => {
                const isSelected = () =>
                  languageSetting() !== "auto" && currentLocale() === locale.code;

                return (
                  <button
                    type="button"
                    onClick={() => handleSelect(locale.code)}
                    class={`w-full px-2.5 py-1.5 flex items-center justify-between text-start transition-colors cursor-pointer hover:bg-accent hover:text-foreground ${
                      isSelected() ? "text-brand font-medium" : "text-muted-foreground"
                    }`}
                  >
                    <span>{locale.label}</span>
                    <Show when={isSelected()}>
                      <Check class="size-3 text-brand" />
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};
