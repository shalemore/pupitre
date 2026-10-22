import type { Settings } from "@shared/settings";
import type { Component } from "solid-js";
import { Select, SettingRow, Switch } from "@/components/ui";
import { type LanguageSetting, SUPPORTED_LOCALES, t } from "@/i18n";
import { settings, updateSettings } from "@/lib/settings";
import { SettingsSection } from "./settings-section";

export const GeneralSection: Component = () => (
  <SettingsSection title={t().settings.general}>
    <SettingRow title={t().settings.language} description={t().settings.languageDesc}>
      <Select<LanguageSetting>
        value={settings().locale}
        onChange={(locale) => void updateSettings({ locale })}
        options={[
          { value: "auto", label: t().settings.followSystem },
          ...SUPPORTED_LOCALES.map((locale) => ({ value: locale.code, label: locale.label })),
        ]}
        aria-label={t().settings.language}
      />
    </SettingRow>

    <SettingRow title={t().settings.startup} description={t().settings.startupDesc}>
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
    </SettingRow>

    <SettingRow title={t().settings.autoSave} description={t().settings.autoSaveDesc}>
      <Switch
        checked={settings().autoSave}
        onChange={(autoSave) => void updateSettings({ autoSave })}
        aria-label={t().settings.autoSave}
      />
    </SettingRow>

    <SettingRow
      title={t().settings.autoCheckUpdates}
      description={t().settings.autoCheckUpdatesDesc}
    >
      <Switch
        checked={settings().autoCheckUpdates}
        onChange={(autoCheckUpdates) => void updateSettings({ autoCheckUpdates })}
        aria-label={t().settings.autoCheckUpdates}
      />
    </SettingRow>
  </SettingsSection>
);
