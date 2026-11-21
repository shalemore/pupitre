import { t } from "@pupitre/i18n/solid";
import { isModified, isWorkspaceKey, type SettingKey } from "@pupitre/settings";
import { IconButton, SettingRow } from "@pupitre/ui";
import type { JSX } from "@solidjs/web";
import { RotateCcw } from "lucide-solid";
import { type ParentComponent, Show } from "solid-js";
import { resetSetting, settings } from "@/lib/settings";
import { workspace } from "@/lib/workspace";

/** A titled page of settings; its children are groups. */
export const SettingsSection: ParentComponent<{ title: string; description?: string }> = (
  props,
) => (
  <section class="max-w-2xl">
    <div class="mb-8">
      <h2 class="text-base font-semibold tracking-tight text-foreground">{props.title}</h2>
      <Show when={props.description}>
        <p class="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
          {props.description}
        </p>
      </Show>
    </div>
    <div class="flex flex-col gap-8">{props.children}</div>
  </section>
);

/** Settings that belong together: hairlines between the rows, more space between groups. */
export const SettingGroup: ParentComponent = (props) => (
  <div class="[&>:not(:last-child)]:border-b [&>:not(:last-child)]:border-hairline [&>:not(:last-child)]:border-border-subtle">
    {props.children}
  </div>
);

export interface SettingFieldProps {
  name: SettingKey;
  title: JSX.Element;
  description?: string | undefined;
  /** The row depends on the one above it and is indented under it. */
  nested?: boolean;
  /** The row opens a group: its title is drawn as the group's heading. */
  heading?: boolean | undefined;
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
      class={props.nested ? "ps-5" : undefined}
      heading={props.heading}
      title={
        <span class="flex items-center gap-1.5">
          {props.title}
          <Show when={modified()}>
            {/* The icon is taller than the title's line; negative margins keep the row from growing when it appears */}
            <IconButton
              label={t().settings.resetToDefault}
              size="icon-2xs"
              onClick={() => void resetSetting(props.name)}
              class="-my-0.5 animate-[appear_var(--transition-duration-snap)]"
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
