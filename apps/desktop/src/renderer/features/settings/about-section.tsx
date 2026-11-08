import { desktop } from "@pupitre/desktop-api/client";
import { t } from "@pupitre/i18n/solid";
import { Button, SettingRow } from "@pupitre/ui";
import pkg from "@root/package.json";
import { BookOpen, FolderOpen } from "lucide-solid";
import { Show, type Component } from "solid-js";
import { workspace } from "@/lib/workspace";
import { css } from "@/styled-system/css";
import { SettingGroup, SettingsSection } from "./settings-section";
import { UpdateButton, UpdateStatusPanel } from "./update-section";

const identity = css({ display: "flex", flexDirection: "column", gap: "3" });
const appCard = css({
  display: "flex",
  alignItems: "center",
  gap: "4",
  padding: "5",
  borderRadius: "lg",
  borderWidth: "hairline",
  borderStyle: "solid",
  borderColor: "border",
  backgroundColor: "surface.2",
});
const logo = css({
  width: "12",
  height: "12",
  flexShrink: 0,
  borderRadius: "xl",
  boxShadow: "sm",
});
const nameBlock = css({ minWidth: "0", flex: "1" });
const appName = css({ textStyle: "base", fontWeight: "semibold", color: "foreground" });
const version = css({
  marginBlockStart: "0.5",
  textStyle: "2xs",
  color: "muted.foreground",
  fontVariantNumeric: "tabular-nums",
});
const status = css({ "& > * + *": { marginBlockStart: "2" } });
const path = css({ fontFamily: "mono", textStyle: "xs" });

export const AboutSection: Component = () => {
  // The file the chosen settings scope writes to, so the row follows the folder switch
  const shownSettingsPath = () => {
    const folder = workspace().settingsPath;
    return workspace().active && folder !== null ? folder : desktop.initialState.settingsPath;
  };
  const revealSettings = () =>
    workspace().active ? desktop.invoke("workspace:reveal") : desktop.invoke("settings:reveal");

  return (
    <SettingsSection title={t().settings.about}>
      <div class={identity}>
        <div class={appCard}>
          <img src="./logo.svg" alt="" class={logo} />
          <div class={nameBlock}>
            <div class={appName}>Pupitre</div>
            <div class={version}>
              {t().settings.version} {pkg.version}
              <Show when={desktop.electronVersion}>{(value) => <> · Electron {value()}</>}</Show>
            </div>
          </div>
          <Show when={desktop.initialState.capabilities.selfUpdate}>
            <UpdateButton />
          </Show>
        </div>
        <div class={status}>
          <UpdateStatusPanel currentVersion={pkg.version} />
        </div>
      </div>

      <SettingGroup>
        <SettingRow heading title={t().about.sampleDocTitle} description={t().about.sampleDocDesc}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void desktop.invoke("app:dispatch", { id: "help.sample-document" })}
          >
            <BookOpen />
            <span>{t().about.openSampleDoc}</span>
          </Button>
        </SettingRow>

        <Show when={desktop.initialState.capabilities.revealFiles}>
          <SettingRow
            title={t().settings.settingsFile}
            description={
              <bdi dir="ltr" class={path}>
                {shownSettingsPath()}
              </bdi>
            }
          >
            <Button variant="outline" size="sm" onClick={() => void revealSettings()}>
              <FolderOpen />
              <span>{t().settings.revealSettingsFile}</span>
            </Button>
          </SettingRow>
        </Show>
      </SettingGroup>
    </SettingsSection>
  );
};
