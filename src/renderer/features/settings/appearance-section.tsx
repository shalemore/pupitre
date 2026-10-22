import type { Settings } from "@shared/settings";
import { Moon, Sun, SunMoon } from "lucide-solid";
import type { Component } from "solid-js";
import { Select, Switch } from "@/components/ui";
import { t } from "@/i18n";
import { settings, updateSettings } from "@/lib/settings";
import { THEME_NAMES } from "@/lib/theme";
import { SettingField, SettingsSection } from "./settings-section";

export const AppearanceSection: Component = () => (
  <SettingsSection title={t().settings.appearance}>
    <SettingField
      name="colorScheme"
      title={t().settings.colorScheme}
      description={t().settings.colorSchemeDesc}
    >
      <Select<Settings["colorScheme"]>
        value={settings().colorScheme}
        onChange={(colorScheme) => void updateSettings({ colorScheme })}
        options={[
          {
            value: "system",
            label: t().settings.followSystem,
            icon: <SunMoon class="size-3.5" />,
          },
          { value: "light", label: t().settings.colorSchemeLight, icon: <Sun class="size-3.5" /> },
          { value: "dark", label: t().settings.colorSchemeDark, icon: <Moon class="size-3.5" /> },
        ]}
        aria-label={t().settings.colorScheme}
      />
    </SettingField>

    <SettingField name="theme" title={t().settings.theme} description={t().settings.themeDesc}>
      <Select
        value={settings().theme}
        onChange={(theme) => void updateSettings({ theme })}
        options={THEME_NAMES.map((name) => ({ value: name, label: name }))}
        aria-label={t().settings.theme}
      />
    </SettingField>

    <SettingField
      name="animations"
      title={t().settings.animations}
      description={t().settings.animationsDesc}
    >
      <Select<Settings["animations"]>
        value={settings().animations}
        onChange={(animations) => void updateSettings({ animations })}
        options={[
          { value: "system", label: t().settings.followSystem },
          { value: "on", label: t().settings.animationsOn },
          { value: "off", label: t().settings.animationsOff },
        ]}
        aria-label={t().settings.animations}
      />
    </SettingField>

    <SettingField
      name="sidebarVisible"
      title={t().settings.showOutline}
      description={t().settings.showOutlineDesc}
    >
      <Switch
        checked={settings().sidebarVisible}
        onChange={(sidebarVisible) => void updateSettings({ sidebarVisible })}
        aria-label={t().settings.showOutline}
      />
    </SettingField>

    <SettingField
      name="showWordCount"
      title={t().settings.showWordCount}
      description={t().settings.showWordCountDesc}
    >
      <Switch
        checked={settings().showWordCount}
        onChange={(showWordCount) => void updateSettings({ showWordCount })}
        aria-label={t().settings.showWordCount}
      />
    </SettingField>
  </SettingsSection>
);
