import { Show, type Component } from "solid-js";
import type { Settings } from "@shared/settings";
import { Select, Slider, Switch } from "@/components/ui";
import { t } from "@/i18n";
import { settings, updateSettings } from "@/lib/settings";
import { FontSelect, RefreshFontsButton } from "./font-select";
import { SettingField, SettingGroup, SettingsSection } from "./settings-section";

export const EditorSection: Component = () => (
  <SettingsSection title={t().settings.editor}>
    <SettingGroup>
      <SettingField
        name="bodyFont"
        title={
          <span class="flex items-center gap-1.5">
            {t().settings.bodyFont}
            <RefreshFontsButton />
          </span>
        }
      >
        <FontSelect
          value={settings().bodyFont}
          onChange={(bodyFont) => void updateSettings({ bodyFont })}
          emptyLabel={t().settings.themeDefault}
          aria-label={t().settings.bodyFont}
        />
      </SettingField>

      <SettingField
        name="fallbackFont"
        title={t().settings.fallbackFont}
        description={t().settings.fallbackFontDesc}
      >
        <FontSelect
          value={settings().fallbackFont}
          onChange={(fallbackFont) => void updateSettings({ fallbackFont })}
          emptyLabel={t().settings.noFallbackFont}
          aria-label={t().settings.fallbackFont}
        />
      </SettingField>

      <SettingField name="codeFont" title={t().settings.codeFont}>
        <FontSelect
          value={settings().codeFont}
          onChange={(codeFont) => void updateSettings({ codeFont })}
          emptyLabel={t().settings.themeDefault}
          aria-label={t().settings.codeFont}
        />
      </SettingField>
    </SettingGroup>

    <SettingGroup>
      <SettingField
        name="fontSize"
        title={t().settings.fontSize}
        description={`${settings().fontSize}px`}
      >
        <Slider
          value={settings().fontSize}
          min={12}
          max={24}
          step={1}
          onChange={(fontSize) => void updateSettings({ fontSize })}
          aria-label={t().settings.fontSize}
        />
      </SettingField>

      <SettingField
        name="lineHeight"
        title={t().settings.lineHeight}
        description={settings().lineHeight.toFixed(2)}
      >
        <Slider
          value={settings().lineHeight}
          min={1.2}
          max={2.4}
          step={0.05}
          onChange={(lineHeight) => void updateSettings({ lineHeight })}
          aria-label={t().settings.lineHeight}
        />
      </SettingField>

      <SettingField name="contentWidth" title={t().settings.contentWidth}>
        <Select<Settings["contentWidth"]>
          value={settings().contentWidth}
          onChange={(contentWidth) => void updateSettings({ contentWidth })}
          options={[
            { value: "compact", label: t().settings.widthCompact },
            { value: "normal", label: t().settings.widthNormal },
            { value: "wide", label: t().settings.widthWide },
            { value: "full", label: t().settings.widthFull },
          ]}
          aria-label={t().settings.contentWidth}
        />
      </SettingField>
    </SettingGroup>

    <SettingGroup>
      <SettingField
        name="spellcheck"
        title={t().settings.spellcheck}
        description={t().settings.spellcheckDesc}
      >
        <Switch
          checked={settings().spellcheck}
          onChange={(spellcheck) => void updateSettings({ spellcheck })}
          aria-label={t().settings.spellcheck}
        />
      </SettingField>

      <SettingField
        name="focusMode"
        title={t().settings.focusMode}
        description={t().settings.focusModeDesc}
      >
        <Switch
          checked={settings().focusMode}
          onChange={(focusMode) => void updateSettings({ focusMode })}
          aria-label={t().settings.focusMode}
        />
      </SettingField>

      <div>
        <SettingField
          name="typewriterMode"
          title={t().settings.typewriterMode}
          description={t().settings.typewriterModeDesc}
        >
          <Switch
            checked={settings().typewriterMode}
            onChange={(typewriterMode) => void updateSettings({ typewriterMode })}
            aria-label={t().settings.typewriterMode}
          />
        </SettingField>
        <Show when={settings().typewriterMode}>
          <SettingField nested name="typewriterPosition" title={t().settings.typewriterPosition}>
            <Select<Settings["typewriterPosition"]>
              value={settings().typewriterPosition}
              onChange={(typewriterPosition) => void updateSettings({ typewriterPosition })}
              options={[
                { value: "center", label: t().settings.typewriterPositionCenter },
                { value: "top", label: t().settings.typewriterPositionTop },
                { value: "bottom", label: t().settings.typewriterPositionBottom },
              ]}
              aria-label={t().settings.typewriterPosition}
            />
          </SettingField>
        </Show>
      </div>
    </SettingGroup>

    <SettingGroup>
      <SettingField name="cursorShape" title={t().settings.cursorShape}>
        <Select<Settings["cursorShape"]>
          value={settings().cursorShape}
          onChange={(cursorShape) => void updateSettings({ cursorShape })}
          options={[
            { value: "bar", label: t().settings.cursorShapeBar },
            { value: "block", label: t().settings.cursorShapeBlock },
            { value: "underline", label: t().settings.cursorShapeUnderline },
          ]}
          aria-label={t().settings.cursorShape}
        />
      </SettingField>

      <SettingField name="cursorBlink" title={t().settings.cursorBlink}>
        <Select<Settings["cursorBlink"]>
          value={settings().cursorBlink}
          onChange={(cursorBlink) => void updateSettings({ cursorBlink })}
          options={[
            { value: "system", label: t().settings.followSystem },
            { value: "smooth", label: t().settings.cursorBlinkSmooth },
            { value: "off", label: t().settings.cursorBlinkOff },
          ]}
          aria-label={t().settings.cursorBlink}
        />
      </SettingField>
    </SettingGroup>

    <SettingGroup>
      <SettingField name="scrollbar" title={t().settings.scrollbar}>
        <Select<Settings["scrollbar"]>
          value={settings().scrollbar}
          onChange={(scrollbar) => void updateSettings({ scrollbar })}
          options={[
            { value: "auto", label: t().settings.scrollbarAuto },
            { value: "always", label: t().settings.scrollbarAlways },
            { value: "never", label: t().settings.scrollbarNever },
          ]}
          aria-label={t().settings.scrollbar}
        />
      </SettingField>

      <SettingField
        name="scrollFade"
        title={t().settings.scrollFade}
        description={t().settings.scrollFadeDesc}
      >
        <Switch
          checked={settings().scrollFade}
          onChange={(scrollFade) => void updateSettings({ scrollFade })}
          aria-label={t().settings.scrollFade}
        />
      </SettingField>
    </SettingGroup>
  </SettingsSection>
);
