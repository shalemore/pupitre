import { BookOpen, FolderOpen } from "lucide-solid";
import type { Component } from "solid-js";
import { Button, Input, Separator } from "@/components/ui";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import pkg from "../../../../package.json";
import { UpdateButton, UpdateStatusPanel } from "./update-section";

export const AboutSection: Component = () => (
  <section class="max-w-xl space-y-4 text-xs">
    <div class="flex items-center gap-3">
      <img src="./logo.svg" alt="" class="size-10 shrink-0 rounded-xl shadow-sm" />
      <div class="min-w-0 flex-1">
        <h2 class="text-base font-semibold text-foreground">Pupitre</h2>
        <div class="text-2xs text-muted-foreground tabular-nums">
          {t().settings.version} {pkg.version} · Electron {desktop.versions.electron}
        </div>
      </div>
      <UpdateButton />
    </div>

    <UpdateStatusPanel currentVersion={pkg.version} />

    <Separator />

    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="font-medium text-foreground">{t().about.sampleDocTitle}</div>
        <div class="truncate text-2xs text-muted-foreground">{t().about.sampleDocDesc}</div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void desktop.invoke("app:dispatch", { id: "help.sample-document" })}
        class="shrink-0"
      >
        <BookOpen />
        <span>{t().about.openSampleDoc}</span>
      </Button>
    </div>

    <Separator />

    <div>
      <div class="mb-2 font-medium text-foreground">{t().settings.settingsFile}</div>
      <div class="flex items-center gap-2">
        <Input readOnly value={desktop.initialState.settingsPath} class="font-mono text-2xs" />
        <Button variant="outline" size="sm" onClick={() => void desktop.invoke("settings:reveal")}>
          <FolderOpen />
          <span>{t().settings.revealSettingsFile}</span>
        </Button>
      </div>
    </div>
  </section>
);
