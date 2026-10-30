import { RotateCcw } from "lucide-solid";
import { type JSX, type ParentComponent, Show } from "solid-js";
import { isModified, isWorkspaceKey, type SettingKey } from "@shared/settings";
import { IconButton, SettingRow } from "@/components/ui";
import { t } from "@/i18n";
import { resetSetting, settings } from "@/lib/settings";
import { workspace } from "@/lib/workspace";
import { css, keyframes } from "@/styled-system/css";

const appear = keyframes({
  from: { opacity: 0, scale: 0.75 },
});

const section = css({ maxWidth: "xl" });
const title = css({
  textStyle: "xs",
  fontWeight: "semibold",
  textTransform: "uppercase",
  letterSpacing: "wider",
  color: "muted.foreground",
});
const description = css({
  marginBlockStart: "1.5",
  textStyle: "2xs",
  lineHeight: "relaxed",
  color: "muted.foreground",
});
const groups = css({
  marginBlockStart: "3",
  "& > :not(:last-child)": { marginBlockEnd: "6" },
});
const group = css({
  "& > :not(:last-child)": {
    borderBottomWidth: "hairline",
    borderBottomStyle: "solid",
    borderColor: "border.subtle",
  },
});
const nested = css({ paddingInlineStart: "4" });
const titleRow = css({ display: "flex", alignItems: "center", gap: "1.5" });
const resetButton = css({ animationName: appear, animationDuration: "snap" });

/** A titled page of settings; its children are groups. */
export const SettingsSection: ParentComponent<{ title: string; description?: string }> = (
  props,
) => (
  <section class={section}>
    <h2 class={title}>{props.title}</h2>
    <Show when={props.description}>
      <p class={description}>{props.description}</p>
    </Show>
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
