import { RotateCcw } from "lucide-solid";
import { type JSX, type ParentComponent, Show } from "solid-js";
import { isModified, isWorkspaceKey, type SettingKey } from "@shared/settings";
import { IconButton, SettingRow } from "@/components/ui";
import { t } from "@/i18n";
import { resetSetting, settings } from "@/lib/settings";
import { workspace } from "@/lib/workspace";

/** A titled page of settings; its children are groups. */
export const SettingsSection: ParentComponent<{ title: string; description?: string }> = (
  props,
) => (
  <section class="max-w-xl">
    <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {props.title}
    </h2>
    <Show when={props.description}>
      <p class="mt-1.5 text-2xs leading-relaxed text-muted-foreground">{props.description}</p>
    </Show>
    <div class="mt-3 space-y-6">{props.children}</div>
  </section>
);

/** Settings that belong together: hairlines between the rows, more space between groups. */
export const SettingGroup: ParentComponent = (props) => (
  <div class="divide-y divide-border-subtle">{props.children}</div>
);

export interface SettingFieldProps {
  name: SettingKey;
  title: JSX.Element;
  description?: string | undefined;
  /** The row depends on the one above it and is indented under it. */
  nested?: boolean;
}

/**
 * A row bound to one setting. When the value differs from the default (from the global value, in
 * a folder's settings) the row gets a reset button that removes the key from the settings file
 * again.
 */
export const SettingField: ParentComponent<SettingFieldProps> = (props) => {
  // A folder's settings are compared with the global values, and the file is the folder's; what a folder cannot set stays global
  const inFolder = () => workspace().active && isWorkspaceKey(props.name);
  const modified = () =>
    inFolder() ? workspace().overrides.includes(props.name) : isModified(settings(), props.name);
  return (
    <SettingRow
      class={props.nested ? "ps-4" : undefined}
      title={
        <span class="flex items-center gap-1.5">
          {props.title}
          <Show when={modified()}>
            <IconButton
              label={t().settings.resetToDefault}
              size="icon-2xs"
              onClick={() => void resetSetting(props.name)}
              class="animate-in fade-in-0 zoom-in-75 duration-snap"
            >
              <RotateCcw />
            </IconButton>
          </Show>
        </span>
      }
      description={props.description}
    >
      {props.children}
    </SettingRow>
  );
};
