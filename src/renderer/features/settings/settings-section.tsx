import { isModified, type SettingKey } from "@shared/settings";
import { RotateCcw } from "lucide-solid";
import { type JSX, type ParentComponent, Show } from "solid-js";
import { SettingRow } from "@/components/ui";
import { t } from "@/i18n";
import { resetSetting, settings } from "@/lib/settings";

/** A titled group of settings rows. */
export const SettingsSection: ParentComponent<{ title: string; description?: string }> = (
  props,
) => (
  <section class="max-w-xl">
    <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {props.title}
    </h2>
    <Show when={props.description}>
      <p class="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{props.description}</p>
    </Show>
    <div class="mt-3 divide-y divide-border/40">{props.children}</div>
  </section>
);

export interface SettingFieldProps {
  name: SettingKey;
  title: JSX.Element;
  description?: string;
}

/**
 * A row bound to one setting. When the value differs from the default the row gets an accent
 * marker and a reset button that removes the key from the settings file again.
 */
export const SettingField: ParentComponent<SettingFieldProps> = (props) => {
  const modified = () => isModified(settings(), props.name);
  return (
    <SettingRow
      class="relative"
      title={
        <span class="flex items-center gap-1.5">
          <Show when={modified()}>
            <span
              aria-hidden="true"
              class="absolute -inset-s-3 inset-y-3 w-0.5 rounded-full bg-brand"
            />
          </Show>
          {props.title}
          <Show when={modified()}>
            <button
              type="button"
              onClick={() => void resetSetting(props.name)}
              title={t().settings.resetToDefault}
              aria-label={t().settings.resetToDefault}
              class="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
            >
              <RotateCcw class="size-3" />
            </button>
          </Show>
        </span>
      }
      description={props.description}
    >
      {props.children}
    </SettingRow>
  );
};
