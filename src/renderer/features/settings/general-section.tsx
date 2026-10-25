import { createSignal, Show, type Component } from "solid-js";
import type { DefaultAppResult } from "@shared/desktop-api";
import type { Settings } from "@shared/settings";
import { Button, Select, SettingRow, Switch } from "@/components/ui";
import { type LanguageSetting, SUPPORTED_LOCALES, t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { settings, updateSettings } from "@/lib/settings";
import { SettingField, SettingGroup, SettingsSection } from "./settings-section";

/** Not a setting: the choice belongs to the system, see src/main/default-app.ts. */
const DefaultAppRow: Component = () => {
  const [result, setResult] = createSignal<DefaultAppResult>();
  const description = () => {
    const labels = t().settings;
    switch (result()) {
      case "done":
        return labels.defaultAppDone;
      case "opened-settings":
        return labels.defaultAppOpenedSettings;
      case "manual":
        return labels.defaultAppManual;
      case "failed":
        return labels.defaultAppFailed;
      default:
        return labels.defaultAppDesc;
    }
  };
  return (
    <SettingRow title={t().settings.defaultApp} description={description()}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void desktop.invoke("app:set-default-markdown-app").then(setResult)}
      >
        {t().settings.setAsDefault}
      </Button>
    </SettingRow>
  );
};

export const GeneralSection: Component = () => (
  <SettingsSection title={t().settings.general}>
    <SettingGroup>
      <SettingField name="locale" title={t().settings.language}>
        <Select<LanguageSetting>
          value={settings().locale}
          onChange={(locale) => void updateSettings({ locale })}
          options={[
            { value: "auto", label: t().settings.followSystem },
            ...SUPPORTED_LOCALES.map((locale) => ({ value: locale.code, label: locale.label })),
          ]}
          aria-label={t().settings.language}
        />
      </SettingField>

      <SettingField name="startup" title={t().settings.startup}>
        <Select<Settings["startup"]>
          value={settings().startup}
          onChange={(startup) => void updateSettings({ startup })}
          options={[
            { value: "welcome", label: t().settings.startupWelcome },
            { value: "last-file", label: t().settings.startupLastFile },
            { value: "new-file", label: t().settings.startupNewFile },
          ]}
          aria-label={t().settings.startup}
        />
      </SettingField>
    </SettingGroup>

    <SettingGroup>
      <SettingField
        name="autoSave"
        title={t().settings.autoSave}
        description={t().settings.autoSaveDesc}
      >
        <Switch
          checked={settings().autoSave}
          onChange={(autoSave) => void updateSettings({ autoSave })}
          aria-label={t().settings.autoSave}
        />
      </SettingField>

      <Show when={desktop.initialState.capabilities.selfUpdate}>
        <SettingField name="autoCheckUpdates" title={t().settings.autoCheckUpdates}>
          <Switch
            checked={settings().autoCheckUpdates}
            onChange={(autoCheckUpdates) => void updateSettings({ autoCheckUpdates })}
            aria-label={t().settings.autoCheckUpdates}
          />
        </SettingField>
      </Show>
    </SettingGroup>

    <Show when={desktop.initialState.capabilities.setDefaultApp}>
      <SettingGroup>
        <DefaultAppRow />
      </SettingGroup>
    </Show>
  </SettingsSection>
);
