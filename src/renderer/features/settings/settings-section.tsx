import { RotateCcw } from "lucide-solid";
import { type JSX, type ParentComponent, Show } from "solid-js";
import { isModified, isWorkspaceKey, type SettingKey } from "@shared/settings";
import { IconButton, SettingRow } from "@/components/ui";
import { t } from "@/i18n";
import { resetSetting, settings } from "@/lib/settings";
import { workspace } from "@/lib/workspace";
import { css } from "@/styled-system/css";

const section = css({ maxWidth: "2xl" });
const header = css({ marginBlockEnd: "8" });
const title = css({
  textStyle: "xl",
  fontWeight: "semibold",
  letterSpacing: "tight",
  color: "foreground",
});
const description = css({
  marginBlockStart: "2",
  maxWidth: "xl",
  textStyle: "sm",
  lineHeight: "relaxed",
  color: "muted.foreground",
});
const groups = css({ display: "flex", flexDirection: "column", gap: "8" });
const group = css({
  "& > :not(:last-child)": {
    borderBottomWidth: "hairline",
    borderBottomStyle: "solid",
    borderColor: "border.subtle",
  },
});
const nested = css({ paddingInlineStart: "5" });
const titleRow = css({ display: "flex", alignItems: "center", gap: "1.5" });
const resetButton = css({ animationName: "appear", animationDuration: "snap" });

/** A titled page of settings; its children are groups. */
export const SettingsSection: ParentComponent<{ title: string; description?: string }> = (
  props,
) => (
  <section class={section}>
    <div class={header}>
      <h2 class={title}>{props.title}</h2>
      <Show when={props.description}>
        <p class={description}>{props.description}</p>
      </Show>
    </div>
    <div class={groups}>{props.children}</div>
  </section>
);

/** Settings that belong together: hairlines between the rows, more space between groups. */
export const SettingGroup: ParentComponent = (props) => <div class={group}>{props.children}</div>;

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
      class={props.nested ? nested : undefined}
      heading={props.heading}
      title={
        <span class={titleRow}>
          {props.title}
          <Show when={modified()}>
            <IconButton
              label={t().settings.resetToDefault}
              size="icon-2xs"
              onClick={() => void resetSetting(props.name)}
              class={resetButton}
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
