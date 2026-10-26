import type { Component } from "solid-js";
import type { Settings } from "@shared/settings";
import { Select, Switch } from "@/components/ui";
import { t } from "@/i18n";
import { settings, updateSettings } from "@/lib/settings";
import { SettingField, SettingGroup, SettingsSection } from "./settings-section";

export const ExportSection: Component = () => (
  <SettingsSection title={t().settings.export} description={t().settings.exportDesc}>
    <SettingGroup>
      <SettingField name="pdfPageSize" title={t().settings.pdfPageSize}>
        <Select<Settings["pdfPageSize"]>
          value={settings().pdfPageSize}
          onChange={(pdfPageSize) => void updateSettings({ pdfPageSize })}
          options={[
            { value: "a4", label: t().settings.pdfPageSizeA4 },
            { value: "letter", label: t().settings.pdfPageSizeLetter },
            { value: "legal", label: t().settings.pdfPageSizeLegal },
          ]}
          aria-label={t().settings.pdfPageSize}
        />
      </SettingField>

      <SettingField name="pdfMargin" title={t().settings.pdfMargin}>
        <Select<Settings["pdfMargin"]>
          value={settings().pdfMargin}
          onChange={(pdfMargin) => void updateSettings({ pdfMargin })}
          options={[
            { value: "none", label: t().settings.pdfMarginNone },
            { value: "narrow", label: t().settings.pdfMarginNarrow },
            { value: "normal", label: t().settings.pdfMarginNormal },
            { value: "wide", label: t().settings.pdfMarginWide },
          ]}
          aria-label={t().settings.pdfMargin}
        />
      </SettingField>
    </SettingGroup>

    <SettingGroup>
      <SettingField
        name="pdfPageNumbers"
        title={t().settings.pdfPageNumbers}
        description={t().settings.pdfPageNumbersDesc}
      >
        <Switch
          checked={settings().pdfPageNumbers}
          onChange={(pdfPageNumbers) => void updateSettings({ pdfPageNumbers })}
          aria-label={t().settings.pdfPageNumbers}
        />
      </SettingField>
    </SettingGroup>
  </SettingsSection>
);
