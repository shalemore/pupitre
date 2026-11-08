import type { PluginInfo } from "@pupitre/desktop-api";
import { desktop } from "@pupitre/desktop-api/client";
import { currentLocale, t } from "@pupitre/i18n/solid";
import { localize } from "@pupitre/plugin-sdk";
import { Button, IconButton, SettingRow, Switch } from "@pupitre/ui";
import { messageOf } from "@pupitre/utils";
import { FolderOpen, Plus, Trash2 } from "lucide-solid";
import { For, onMount, Show, type Component } from "solid-js";
import { reportFailure } from "@/lib/errors";
import { loadPlugins, plugins } from "@/lib/plugins";
import { css } from "@/styled-system/css";
import { SettingGroup, SettingsSection } from "./settings-section";

const toolbar = css({ marginBlockEnd: "4" });
const empty = css({ textStyle: "sm", color: "muted.foreground" });
const titleRow = css({ display: "flex", alignItems: "baseline", gap: "2" });
const version = css({
  textStyle: "2xs",
  color: "tertiary",
  fontVariantNumeric: "tabular-nums",
});
const permissions = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "1.5",
  marginBlockStart: "1",
});
const permissionChip = css({
  paddingInline: "1.5",
  paddingBlock: "0.5",
  borderRadius: "sm",
  backgroundColor: "surface.2",
  fontFamily: "mono",
  textStyle: "2xs",
  color: "muted.foreground",
});

/** Runs an action that may fail, telling the user what stopped it rather than leaving it silent. */
function attempt(run: () => Promise<unknown>): void {
  void run().catch((error: unknown) =>
    reportFailure(t().dialogs.fileActionFailed, messageOf(error)),
  );
}

const PluginRow: Component<{ plugin: PluginInfo }> = (props) => {
  const name = () => localize(props.plugin.manifest.name, currentLocale());
  const description = () => {
    const text = props.plugin.manifest.description;
    return text === undefined ? undefined : localize(text, currentLocale());
  };
  const author = () => props.plugin.manifest.author;
  const details = () => {
    if (
      description() === undefined &&
      author() === undefined &&
      props.plugin.manifest.permissions.length === 0
    ) {
      return undefined;
    }
    return (
      <>
        <Show when={description()}>{(text) => <>{text()}</>}</Show>
        <Show when={author()}>{(value) => <>{` · ${value()}`}</>}</Show>
        <Show when={props.plugin.manifest.permissions.length > 0}>
          <div class={permissions}>
            <span>{t().settings.permissions}</span>
            <For each={props.plugin.manifest.permissions}>
              {(permission) => <code class={permissionChip}>{permission}</code>}
            </For>
          </div>
        </Show>
      </>
    );
  };

  const setEnabled = (enabled: boolean) =>
    attempt(async () => {
      // Turning a plugin on is the consent: it receives exactly what its manifest asks for
      if (enabled)
        await desktop.invoke("plugins:grant", props.plugin.id, props.plugin.manifest.permissions);
      await desktop.invoke("plugins:set-enabled", props.plugin.id, enabled);
    });

  return (
    <SettingRow
      heading
      title={
        <span class={titleRow}>
          <span>{name()}</span>
          <span class={version}>v{props.plugin.manifest.version}</span>
        </span>
      }
      description={details()}
    >
      <IconButton
        label={t().settings.revealSettingsFile}
        size="icon-2xs"
        onClick={() => attempt(() => desktop.invoke("plugins:reveal", props.plugin.id))}
      >
        <FolderOpen />
      </IconButton>
      <IconButton
        label={t().sidebar.moveToTrash}
        size="icon-2xs"
        onClick={() => attempt(() => desktop.invoke("plugins:uninstall", props.plugin.id))}
      >
        <Trash2 />
      </IconButton>
      <Switch
        checked={props.plugin.enabled}
        aria-label={name()}
        onChange={(enabled) => setEnabled(enabled)}
      />
    </SettingRow>
  );
};

export const PluginsSection: Component = () => {
  onMount(loadPlugins);

  return (
    <SettingsSection title={t().settings.plugins}>
      <div class={toolbar}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => attempt(() => desktop.invoke("plugins:install"))}
        >
          <Plus />
          <span>{t().settings.installPlugin}</span>
        </Button>
      </div>
      <Show when={plugins().length > 0} fallback={<p class={empty}>{t().settings.noPlugins}</p>}>
        <SettingGroup>
          <For each={plugins()}>{(plugin) => <PluginRow plugin={plugin} />}</For>
        </SettingGroup>
      </Show>
    </SettingsSection>
  );
};
