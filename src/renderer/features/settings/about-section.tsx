import { BookOpen, FolderOpen } from "lucide-solid";
import { Show, type Component } from "solid-js";
import { Button, Input, Separator } from "@/components/ui";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { css } from "@/styled-system/css";
import pkg from "../../../../package.json";
import { UpdateButton, UpdateStatusPanel } from "./update-section";

export const AboutSection: Component = () => (
  <section
    class={css({
      maxWidth: "xl",
      textStyle: "xs",
      "& > :not(:last-child)": { marginBlockEnd: "4" },
    })}
  >
    <div class={css({ display: "flex", alignItems: "center", gap: "3" })}>
      <img
        src="./logo.svg"
        alt=""
        class={css({
          width: "10",
          height: "10",
          flexShrink: 0,
          borderRadius: "xl",
          boxShadow: "sm",
        })}
      />
      <div class={css({ minWidth: 0, flex: "1" })}>
        <h2 class={css({ textStyle: "base", fontWeight: "semibold", color: "foreground" })}>
          Pupitre
        </h2>
        <div
          class={css({
            textStyle: "2xs",
            color: "muted.foreground",
            fontVariantNumeric: "tabular-nums",
          })}
        >
          {t().settings.version} {pkg.version}
          <Show when={desktop.electronVersion}>{(version) => <> · Electron {version()}</>}</Show>
        </div>
      </div>
      <Show when={desktop.initialState.capabilities.selfUpdate}>
        <UpdateButton />
      </Show>
    </div>

    <UpdateStatusPanel currentVersion={pkg.version} />

    <Separator />

    <div
      class={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "3",
      })}
    >
      <div class={css({ minWidth: 0 })}>
        <div class={css({ fontWeight: "medium", color: "foreground" })}>
          {t().about.sampleDocTitle}
        </div>
        <div
          class={css({
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textStyle: "2xs",
            color: "muted.foreground",
          })}
        >
          {t().about.sampleDocDesc}
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void desktop.invoke("app:dispatch", { id: "help.sample-document" })}
        class={css({ flexShrink: 0 })}
      >
        <BookOpen />
        <span>{t().about.openSampleDoc}</span>
      </Button>
    </div>

    <Show when={desktop.initialState.capabilities.revealFiles}>
      <Separator />

      <div>
        <div class={css({ marginBlockEnd: "2", fontWeight: "medium", color: "foreground" })}>
          {t().settings.settingsFile}
        </div>
        <div class={css({ display: "flex", alignItems: "center", gap: "2" })}>
          <Input
            readOnly
            dir="ltr"
            value={desktop.initialState.settingsPath}
            class={css({ fontFamily: "mono", textStyle: "2xs" })}
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
