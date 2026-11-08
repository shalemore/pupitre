import type { PluginInfo } from "@pupitre/desktop-api";
import { desktop } from "@pupitre/desktop-api/client";
import { currentLocale, t } from "@pupitre/i18n/solid";
import { localize, type LocalizedText } from "@pupitre/plugin-sdk";
import { Button, IconButton, Input, Select, SettingRow, Switch } from "@pupitre/ui";
import { messageOf } from "@pupitre/utils";
import { FolderOpen, Plus, Trash2 } from "lucide-solid";
import { For, onMount, Show, type Component, type JSX } from "solid-js";
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

const form = css({
  display: "flex",
  flexDirection: "column",
  paddingInlineStart: "5",
  "& > * + *": {
    borderTopWidth: "hairline",
    borderTopStyle: "solid",
    borderColor: "border.subtle",
  },
});
const fieldInput = css({ width: "48" });

/** One property of the JSON Schema a plugin sent; only the kinds a form can draw are read. */
interface SchemaField {
  type?: unknown;
  enum?: unknown;
  minimum?: unknown;
  maximum?: unknown;
}

function fieldEntries(schema: Readonly<Record<string, unknown>>): [string, SchemaField][] {
  const properties = schema["properties"];
  if (typeof properties !== "object" || properties === null || Array.isArray(properties)) return [];
  const entries: [string, SchemaField][] = [];
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      entries.push([key, value]);
    }
  }
  return entries;
}

function textOf(text: LocalizedText | undefined): string | undefined {
  return text === undefined ? undefined : localize(text, currentLocale());
}

function fieldControl(
  field: SchemaField,
  value: unknown,
  label: string,
  onChange: (value: unknown) => void,
): JSX.Element {
  if (field.type === "boolean") {
    return (
      <Switch
        checked={value === true}
        aria-label={label}
        onChange={(checked) => onChange(checked)}
      />
    );
  }
  if (field.type === "number" || field.type === "integer") {
    return (
      <Input
        class={fieldInput}
        type="number"
        aria-label={label}
        value={typeof value === "number" ? String(value) : ""}
        min={typeof field.minimum === "number" ? field.minimum : undefined}
        max={typeof field.maximum === "number" ? field.maximum : undefined}
        step={field.type === "integer" ? 1 : "any"}
        onChange={(event) => {
          const parsed = event.currentTarget.valueAsNumber;
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
      />
    );
  }
  if (field.type === "string") {
    const choices = Array.isArray(field.enum)
      ? field.enum.filter((entry): entry is string => typeof entry === "string")
      : [];
    if (choices.length > 0) {
      return (
        <Select
          value={typeof value === "string" ? value : (choices[0] ?? "")}
          options={choices.map((choice) => ({ value: choice, label: choice }))}
          onChange={(choice) => onChange(choice)}
          aria-label={label}
        />
      );
    }
    return (
      <Input
        class={fieldInput}
        aria-label={label}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  }
  return undefined;
}

/** The fields a plugin declared, drawn from its schema and named in its own words. */
const PluginSettingsForm: Component<{ plugin: PluginInfo }> = (props) => {
  const fields = () => {
    const settings = props.plugin.settings;
    return settings === undefined ? [] : fieldEntries(settings.schema);
  };
  const update = (key: string, value: unknown) => {
    const settings = props.plugin.settings;
    if (settings === undefined) return;
    attempt(() =>
      desktop.invoke("plugins:update-settings", props.plugin.id, {
        ...settings.values,
        [key]: value,
      }),
    );
  };

  return (
    <Show when={fields().length > 0}>
      <div class={form}>
        <For each={fields()}>
          {([key, field]) => {
            const label = () => textOf(props.plugin.settings?.fields?.[key]?.title) ?? key;
            return (
              <SettingRow
                title={label()}
                description={textOf(props.plugin.settings?.fields?.[key]?.description)}
              >
                {fieldControl(field, props.plugin.settings?.values[key], label(), (value) =>
                  update(key, value),
                )}
              </SettingRow>
            );
          }}
        </For>
      </div>
    </Show>
  );
};

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
    <>
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
      <PluginSettingsForm plugin={props.plugin} />
    </>
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
