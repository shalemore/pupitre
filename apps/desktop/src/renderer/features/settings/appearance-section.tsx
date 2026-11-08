import { SETTING_RANGES, type Settings } from "@pupitre/settings";
import { Callout, IconButton, Select, Slider, Switch } from "@pupitre/ui";
import { FolderOpen, Globe } from "lucide-solid";
import { For, Show, type Component } from "solid-js";
import { currentLocale, t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { formatPercent } from "@/lib/number-format";
import { isImmersive, settings, updateSettings } from "@/lib/settings";
import type { SidebarSide } from "@/lib/sidebar";
import { DEFAULT_THEME, type ThemeInfo, themeDisplayName, themes } from "@/lib/theme";
import { css } from "@/styled-system/css";
import { FontSelect, themeFontLabel } from "./font-select";
import { SettingField, SettingGroup, SettingsSection } from "./settings-section";

const stack = css({ "& > :not(:last-child)": { marginBlockEnd: "1" } });

function schemeLabel(theme: ThemeInfo): string {
  if (theme.schemes.length > 1) return t().settings.schemeBoth;
  return theme.schemes.includes("dark")
    ? t().settings.colorSchemeDark
    : t().settings.colorSchemeLight;
}

function sourceBadge(theme: ThemeInfo): string | undefined {
  if (theme.source === "global") return t().settings.scopeGlobal;
  if (theme.source === "project") return t().settings.scopeFolder;
  return undefined;
}

function themeOptions(onlyDark = false) {
  const all = themes().filter((theme) => !onlyDark || theme.schemes.includes("dark"));
  const labels = all.map((theme) => themeDisplayName(theme, currentLocale()));
  const duplicated = new Set(labels.filter((label, index) => labels.indexOf(label) !== index));
  return all.map((theme) => {
    const label = themeDisplayName(theme, currentLocale());
    return {
      value: theme.id,
      label,
      hint: duplicated.has(label) ? theme.name : undefined,
      badge: sourceBadge(theme),
      description: schemeLabel(theme),
    };
  });
}

/** The stored theme may point at a folder that has since gone; the default stands in then. */
function currentThemeId(): string {
  const id = settings().theme;
  return themes().some((theme) => theme.id === id) ? id : DEFAULT_THEME;
}

/** The folder the current theme lives in; a built-in theme opens the folder imported ones go in. */
function themeFolder(): "global" | "project" {
  const theme = themes().find((candidate) => candidate.id === currentThemeId());
  return theme?.source === "project" ? "project" : "global";
}

function currentDarkThemeId(): string {
  const id = settings().darkTheme;
  if (id === "") return "";
  return themes().some((theme) => theme.id === id) ? id : "";
}

/** A stored theme may point at a folder that has since gone; say so instead of switching silently. */
function missingThemeMessages(): string[] {
  const available = (id: string) => themes().some((theme) => theme.id === id);
  const messages: string[] = [];
  if (!available(settings().theme)) messages.push(t().settings.themeMissing);
  if (settings().darkTheme !== "" && !available(settings().darkTheme)) {
    messages.push(t().settings.darkThemeMissing);
  }
  return messages;
}

/** The sidebar's control is the pin an immersive window offers, or the collapse a classic one does. */
function sidebarControlTitle(side: SidebarSide): string {
  const name = side === "start" ? t().sidebar.folder : t().sidebar.outline;
  if (!isImmersive()) {
    return settings().sidebarLayout === "split"
      ? t().settings.collapseSidebarName(name)
      : t().sidebar.collapseSidebar;
  }
  return settings().sidebarLayout === "split"
    ? t().settings.pinSidebar(name)
    : t().settings.pinSidebars;
}

/** The switch of one sidebar, which edits its state in the key of the current window style. */
const SidebarStateField: Component<{ side: SidebarSide }> = (props) => {
  const field = () => {
    if (props.side === "start") {
      return isImmersive()
        ? {
            name: "sidebarPinnedStart" as const,
            checked: settings().sidebarPinnedStart,
            onChange: (value: boolean) => void updateSettings({ sidebarPinnedStart: value }),
          }
        : {
            name: "sidebarCollapsedStart" as const,
            checked: settings().sidebarCollapsedStart,
            onChange: (value: boolean) => void updateSettings({ sidebarCollapsedStart: value }),
          };
    }
    return isImmersive()
      ? {
          name: "sidebarPinnedEnd" as const,
          checked: settings().sidebarPinnedEnd,
          onChange: (value: boolean) => void updateSettings({ sidebarPinnedEnd: value }),
        }
      : {
          name: "sidebarCollapsedEnd" as const,
          checked: settings().sidebarCollapsedEnd,
          onChange: (value: boolean) => void updateSettings({ sidebarCollapsedEnd: value }),
        };
  };
  const title = () => sidebarControlTitle(props.side);

  return (
    <SettingField
      nested
      name={field().name}
      title={title()}
      description={
        isImmersive() && props.side === "start" ? t().settings.pinSidebarsDesc : undefined
      }
    >
      <Switch checked={field().checked} onChange={field().onChange} aria-label={title()} />
    </SettingField>
  );
};

export const AppearanceSection: Component = () => (
  <SettingsSection title={t().settings.appearance}>
    <Show when={missingThemeMessages().length > 0}>
      <Callout variant="destructive" class={stack}>
        <For each={missingThemeMessages()}>{(message) => <p>{message}</p>}</For>
      </Callout>
    </Show>

    <SettingGroup>
      <SettingField heading name="colorScheme" title={t().settings.colorScheme}>
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

      <SettingField
        name="theme"
        title={
          <>
            {t().settings.theme}
            <IconButton
              label={`${t().settings.theme} · ${
                themeFolder() === "project" ? t().settings.scopeFolder : t().settings.scopeGlobal
              }`}
              size="icon-2xs"
              onClick={() => void desktop.invoke("themes:reveal", themeFolder())}
            >
              <Show when={themeFolder() === "project"} fallback={<Globe />}>
                <FolderOpen />
              </Show>
            </IconButton>
          </>
        }
      >
        <Select
          value={currentThemeId()}
          onChange={(theme) => void updateSettings({ theme })}
          options={themeOptions()}
          aria-label={t().settings.theme}
        />
      </SettingField>

      <SettingField
        name="darkTheme"
        title={t().settings.darkTheme}
        description={t().settings.darkThemeDesc}
      >
        <Select
          value={currentDarkThemeId()}
          onChange={(darkTheme) => void updateSettings({ darkTheme })}
          options={[{ value: "", label: t().settings.sameTheme }, ...themeOptions(true)]}
          aria-label={t().settings.darkTheme}
        />
      </SettingField>
    </SettingGroup>

    <SettingGroup>
      <SettingField
        heading
        name="uiFont"
        title={t().settings.uiFont}
        description={t().settings.uiFontDesc}
      >
        <FontSelect
          value={settings().uiFont}
          onChange={(uiFont) => void updateSettings({ uiFont })}
          emptyLabel={themeFontLabel("font-sans")}
          aria-label={t().settings.uiFont}
        />
      </SettingField>

      <Show when={desktop.initialState.capabilities.zoom}>
        <SettingField
          name="zoom"
          title={t().settings.zoom}
          description={formatPercent(settings().zoom / 100)}
        >
          <Slider
            value={settings().zoom}
            min={SETTING_RANGES.zoom.min}
            max={SETTING_RANGES.zoom.max}
            step={SETTING_RANGES.zoom.step}
            onChange={(zoom) => void updateSettings({ zoom })}
            aria-label={t().settings.zoom}
          />
        </SettingField>
      </Show>

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
    </SettingGroup>

    <SettingGroup>
      <SettingField heading name="windowStyle" title={t().settings.windowStyle}>
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

      <Show when={isImmersive()}>
        <SettingField
          nested
          name="immersiveGap"
          title={t().settings.immersiveGap}
          description={`${settings().immersiveGap}px`}
        >
          <Slider
            value={settings().immersiveGap}
            min={SETTING_RANGES.immersiveGap.min}
            max={SETTING_RANGES.immersiveGap.max}
            step={SETTING_RANGES.immersiveGap.step}
            onChange={(immersiveGap) => void updateSettings({ immersiveGap })}
            aria-label={t().settings.immersiveGap}
          />
        </SettingField>
      </Show>

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

      <SettingField name="tabs" title={t().settings.tabs} description={t().settings.tabsDesc}>
        <Switch
          checked={settings().tabs}
          onChange={(tabs) => void updateSettings({ tabs })}
          aria-label={t().settings.tabs}
        />
      </SettingField>
      <Show when={settings().tabs}>
        <SettingField
          nested
          name="hideSingleTab"
          title={t().settings.hideSingleTab}
          description={t().settings.hideSingleTabDesc}
        >
          <Switch
            checked={settings().hideSingleTab}
            onChange={(hideSingleTab) => void updateSettings({ hideSingleTab })}
            aria-label={t().settings.hideSingleTab}
          />
        </SettingField>
      </Show>
    </SettingGroup>

    <SettingGroup>
      <div>
        <SettingField heading name="sidebarVisible" title={t().settings.showOutline}>
          <Switch
            checked={settings().sidebarVisible}
            onChange={(sidebarVisible) => void updateSettings({ sidebarVisible })}
            aria-label={t().settings.showOutline}
          />
        </SettingField>
        <Show when={settings().sidebarVisible}>
          <SettingField
            nested
            name="sidebarLayout"
            title={t().settings.sidebarLayout}
            description={t().settings.sidebarLayoutDesc}
          >
            <Select<Settings["sidebarLayout"]>
              value={settings().sidebarLayout}
              onChange={(sidebarLayout) => void updateSettings({ sidebarLayout })}
              options={[
                { value: "split", label: t().settings.sidebarLayoutSplit },
                { value: "combined", label: t().settings.sidebarLayoutCombined },
              ]}
              aria-label={t().settings.sidebarLayout}
            />
          </SettingField>
          <SettingField
            nested
            name="sidebarPreview"
            title={t().settings.filePreviews}
            description={t().settings.filePreviewsDesc}
          >
            <Switch
              checked={settings().sidebarPreview}
              onChange={(sidebarPreview) => void updateSettings({ sidebarPreview })}
              aria-label={t().settings.filePreviews}
            />
          </SettingField>
          <SettingField
            nested
            name="showHidden"
            title={t().settings.showHidden}
            description={t().settings.showHiddenDesc}
          >
            <Switch
              checked={settings().showHidden}
              onChange={(showHidden) => void updateSettings({ showHidden })}
              aria-label={t().settings.showHidden}
            />
          </SettingField>
        </Show>
        <Show when={settings().sidebarVisible}>
          <SidebarStateField side="start" />
          <Show when={settings().sidebarLayout === "split"}>
            <SidebarStateField side="end" />
          </Show>
        </Show>
      </div>
    </SettingGroup>
  </SettingsSection>
);
