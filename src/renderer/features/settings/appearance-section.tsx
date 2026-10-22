import type { Settings } from "@shared/settings";
import type { Component } from "solid-js";
import { Select, Switch } from "@/components/ui";
import { t } from "@/i18n";
import { settings, updateSettings } from "@/lib/settings";
import { type ThemeInfo, THEMES } from "@/lib/theme";
import { FontSelect } from "./font-select";
import { SettingField, SettingsSection } from "./settings-section";

function schemeLabel(theme: ThemeInfo): string {
  if (theme.schemes.length > 1) return t().settings.schemeBoth;
  return theme.schemes.includes("dark")
    ? t().settings.colorSchemeDark
    : t().settings.colorSchemeLight;
}

function themeOption(theme: ThemeInfo) {
  return { value: theme.name, label: theme.name, description: schemeLabel(theme) };
}

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
          { value: "system", label: t().settings.followSystem },
          { value: "light", label: t().settings.colorSchemeLight },
          { value: "dark", label: t().settings.colorSchemeDark },
        ]}
        aria-label={t().settings.colorScheme}
      />
    </SettingField>

    <SettingField name="theme" title={t().settings.theme} description={t().settings.themeDesc}>
      <Select
        value={settings().theme}
        onChange={(theme) => void updateSettings({ theme })}
        options={THEMES.map(themeOption)}
        aria-label={t().settings.theme}
      />
    </SettingField>

    <SettingField
      name="darkTheme"
      title={t().settings.darkTheme}
      description={t().settings.darkThemeDesc}
    >
      <Select
        value={settings().darkTheme}
        onChange={(darkTheme) => void updateSettings({ darkTheme })}
        options={[
          { value: "", label: t().settings.sameTheme },
          ...THEMES.filter((theme) => theme.schemes.includes("dark")).map(themeOption),
        ]}
        aria-label={t().settings.darkTheme}
      />
    </SettingField>

    <SettingField name="uiFont" title={t().settings.uiFont} description={t().settings.uiFontDesc}>
      <FontSelect
        value={settings().uiFont}
        onChange={(uiFont) => void updateSettings({ uiFont })}
        emptyLabel={t().settings.systemDefault}
        aria-label={t().settings.uiFont}
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
      name="windowStyle"
      title={t().settings.windowStyle}
      description={t().settings.windowStyleDesc}
    >
      <Select<Settings["windowStyle"]>
        value={settings().windowStyle}
        onChange={(windowStyle) => void updateSettings({ windowStyle })}
        options={[
          { value: "classic", label: t().settings.windowStyleClassic },
          { value: "immersive", label: t().settings.windowStyleImmersive },
        ]}
        aria-label={t().settings.windowStyle}
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
