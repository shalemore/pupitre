import { BookOpen, FolderOpen } from "lucide-solid";
import { Show, type Component } from "solid-js";
import { Button, Input, Separator } from "@/components/ui";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { shrinkNone, truncate } from "@/lib/styles";
import { css, cx } from "@/styled-system/css";
import pkg from "../../../../package.json";
import { UpdateButton, UpdateStatusPanel } from "./update-section";

const section = css({
  maxWidth: "xl",
  textStyle: "xs",
  "& > :not(:last-child)": { marginBlockEnd: "4" },
});
const header = css({ display: "flex", alignItems: "center", gap: "3" });
const logo = css({
  width: "10",
  height: "10",
  flexShrink: 0,
  borderRadius: "xl",
  boxShadow: "sm",
});
const nameBlock = css({ minWidth: 0, flex: "1" });
const appName = css({ textStyle: "base", fontWeight: "semibold", color: "foreground" });
const version = css({
  textStyle: "2xs",
  color: "muted.foreground",
  fontVariantNumeric: "tabular-nums",
});
const row = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "3",
});
const rowText = css({ minWidth: 0 });
const rowTitle = css({ fontWeight: "medium", color: "foreground" });
const rowDescription = css({ textStyle: "2xs", color: "muted.foreground" });
const settingsTitle = css({ marginBlockEnd: "2", fontWeight: "medium", color: "foreground" });
const settingsRow = css({ display: "flex", alignItems: "center", gap: "2" });
const settingsPath = css({ fontFamily: "mono", textStyle: "2xs" });

export const AboutSection: Component = () => (
  <section class={section}>
    <div class={header}>
      <img src="./logo.svg" alt="" class={logo} />
      <div class={nameBlock}>
        <h2 class={appName}>Pupitre</h2>
        <div class={version}>
          {t().settings.version} {pkg.version}
          <Show when={desktop.electronVersion}>{(value) => <> · Electron {value()}</>}</Show>
        </div>
      </div>
      <Show when={desktop.initialState.capabilities.selfUpdate}>
        <UpdateButton />
      </Show>
    </div>

    <UpdateStatusPanel currentVersion={pkg.version} />

    <Separator />

    <div class={row}>
      <div class={rowText}>
        <div class={rowTitle}>{t().about.sampleDocTitle}</div>
        <div class={cx(truncate, rowDescription)}>{t().about.sampleDocDesc}</div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void desktop.invoke("app:dispatch", { id: "help.sample-document" })}
        class={shrinkNone}
      >
        <BookOpen />
        <span>{t().about.openSampleDoc}</span>
      </Button>
    </div>

    <Show when={desktop.initialState.capabilities.revealFiles}>
      <Separator />

      <div>
        <div class={settingsTitle}>{t().settings.settingsFile}</div>
        <div class={settingsRow}>
          <Input
            readOnly
            dir="ltr"
            value={desktop.initialState.settingsPath}
            class={settingsPath}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void desktop.invoke("settings:reveal")}
          >
            <FolderOpen />
            <span>{t().settings.revealSettingsFile}</span>
          </Button>
        </div>
      </div>
    </Show>
  </section>
);
