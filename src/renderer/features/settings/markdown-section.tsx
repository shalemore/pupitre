import type { Component } from "solid-js";
import type { Settings } from "@shared/settings";
import { Input, Select } from "@/components/ui";
import { t } from "@/i18n";
import { settings, updateSettings } from "@/lib/settings";
import { SettingField, SettingGroup, SettingsSection } from "./settings-section";

export const MarkdownSection: Component = () => (
  <SettingsSection title={t().settings.markdown} description={t().settings.markdownDesc}>
    <SettingGroup>
      <SettingField name="bulletMarker" title={t().settings.bulletMarker}>
        <Select<Settings["bulletMarker"]>
          value={settings().bulletMarker}
          onChange={(bulletMarker) => void updateSettings({ bulletMarker })}
          options={[
            { value: "-", label: "- item" },
            { value: "*", label: "* item" },
            { value: "+", label: "+ item" },
          ]}
          aria-label={t().settings.bulletMarker}
        />
      </SettingField>

      <SettingField name="incrementListMarker" title={t().settings.orderedList}>
        <Select<"increment" | "same">
          value={settings().incrementListMarker ? "increment" : "same"}
          onChange={(mode) => void updateSettings({ incrementListMarker: mode === "increment" })}
          options={[
            { value: "increment", label: t().settings.orderedListIncrement },
            { value: "same", label: t().settings.orderedListSame },
          ]}
          aria-label={t().settings.orderedList}
        />
      </SettingField>
    </SettingGroup>

    <SettingGroup>
      <SettingField name="emphasisMarker" title={t().settings.emphasisMarker}>
        <Select<Settings["emphasisMarker"]>
          value={settings().emphasisMarker}
          onChange={(emphasisMarker) => void updateSettings({ emphasisMarker })}
          options={[
            { value: "*", label: "*italic*" },
            { value: "_", label: "_italic_" },
          ]}
          aria-label={t().settings.emphasisMarker}
        />
      </SettingField>

      <SettingField name="strongMarker" title={t().settings.strongMarker}>
        <Select<Settings["strongMarker"]>
          value={settings().strongMarker}
          onChange={(strongMarker) => void updateSettings({ strongMarker })}
          options={[
            { value: "*", label: "**bold**" },
            { value: "_", label: "__bold__" },
          ]}
          aria-label={t().settings.strongMarker}
        />
      </SettingField>

      <SettingField name="fenceMarker" title={t().settings.fenceMarker}>
        <Select<Settings["fenceMarker"]>
          value={settings().fenceMarker}
          onChange={(fenceMarker) => void updateSettings({ fenceMarker })}
          options={[
            { value: "`", label: "```" },
            { value: "~", label: "~~~" },
          ]}
          aria-label={t().settings.fenceMarker}
        />
      </SettingField>

      <SettingField name="ruleMarker" title={t().settings.ruleMarker}>
        <Select<Settings["ruleMarker"]>
          value={settings().ruleMarker}
          onChange={(ruleMarker) => void updateSettings({ ruleMarker })}
          options={[
            { value: "-", label: "---" },
            { value: "*", label: "***" },
            { value: "_", label: "___" },
          ]}
          aria-label={t().settings.ruleMarker}
        />
      </SettingField>
    </SettingGroup>

    <SettingGroup>
      <SettingField name="lineEnding" title={t().settings.lineEnding}>
        <Select<Settings["lineEnding"]>
          value={settings().lineEnding}
          onChange={(lineEnding) => void updateSettings({ lineEnding })}
          options={[
            { value: "auto", label: t().settings.lineEndingAuto },
            { value: "lf", label: "LF" },
            { value: "crlf", label: "CRLF" },
          ]}
          aria-label={t().settings.lineEnding}
        />
      </SettingField>

      <SettingField
        name="imageFolder"
        title={t().settings.imageFolder}
        description={t().settings.imageFolderDesc}
      >
        <Input
          value={settings().imageFolder}
          // "change" only fires on blur or Enter, so the settings file is not rewritten per keystroke
          onChange={(e) => {
            const imageFolder = e.currentTarget.value.trim();
            if (imageFolder) void updateSettings({ imageFolder });
            else e.currentTarget.value = settings().imageFolder;
          }}
          class="w-36 font-mono"
          aria-label={t().settings.imageFolder}
        />
      </SettingField>
    </SettingGroup>
  </SettingsSection>
);
