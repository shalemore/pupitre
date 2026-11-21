import { desktop } from "@pupitre/desktop-api/client";
import { t } from "@pupitre/i18n/solid";
import { Button, SettingRow } from "@pupitre/ui";
import pkg from "@root/package.json";
import { BookOpen, FolderOpen } from "lucide-solid";
import { Show, type Component } from "solid-js";
import { PUBLIC_LOGO } from "@/lib/public-asset";
import { workspace } from "@/lib/workspace";
import { SettingGroup, SettingsSection } from "./settings-section";
import { UpdateButton, UpdateStatusPanel } from "./update-section";

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
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-4 rounded-lg border border-hairline border-border bg-surface-2 p-5">
          <img src={PUBLIC_LOGO} alt="" class="size-12 shrink-0 rounded-xl shadow-sm" />
          <div class="min-w-0 flex-1">
            <div class="text-base font-semibold text-foreground">Pupitre</div>
            <div class="mt-0.5 text-2xs text-muted-foreground tabular-nums">
              {t().settings.version} {pkg.version}
              <Show when={desktop.electronVersion}>{(value) => <> · Electron {value()}</>}</Show>
            </div>
          </div>
          <Show when={desktop.initialState.capabilities.selfUpdate}>
            <UpdateButton />
          </Show>
        </div>
        <div class="space-y-2">
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
              <bdi dir="ltr" class="font-mono text-xs">
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
