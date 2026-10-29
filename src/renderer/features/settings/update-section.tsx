import { Progress } from "@kobalte/core/progress";
import { cn } from "cn";
import { CheckCircle2, Download, RefreshCw } from "lucide-solid";
import { createMemo, Show, type Component } from "solid-js";
import type { UpdateStatus } from "@shared/desktop-api";
import { Button, Callout, ScrollView } from "@/components/ui";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { formatPercent } from "@/lib/format";
import { updateStatus } from "@/lib/updater";

function hasKind<K extends UpdateStatus["kind"]>(
  status: UpdateStatus,
  kind: K,
): status is Extract<UpdateStatus, { kind: K }> {
  return status.kind === kind;
}

/** Picks the update status of the given kind; together with `<Show>` it gives children the narrowed type. */
function useStatus<K extends UpdateStatus["kind"]>(kind: K) {
  return createMemo(() => {
    const status = updateStatus();
    return hasKind(status, kind) ? status : undefined;
  });
}

export const UpdateButton: Component = () => {
  const isBusy = () => updateStatus().kind === "checking" || updateStatus().kind === "downloading";
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void desktop.invoke("updater:check")}
      disabled={isBusy()}
    >
      <RefreshCw class={cn(updateStatus().kind === "checking" && "animate-spin")} />
      <span>
        {updateStatus().kind === "checking"
          ? t().settings.checkingForUpdates
          : t().settings.checkForUpdates}
      </span>
    </Button>
  );
};

export const UpdateStatusPanel: Component<{ currentVersion: string }> = (props) => {
  const available = useStatus("available");
  const downloading = useStatus("downloading");
  const failed = useStatus("error");

  return (
    <>
      <Show when={updateStatus().kind === "up-to-date"}>
        <Callout variant="success" class="flex items-center gap-2 text-success">
          <CheckCircle2 />
          <span>
            {t().settings.upToDate} (v{props.currentVersion})
          </span>
        </Callout>
      </Show>

      <Show when={available()}>
        {(status) => (
          <Callout variant="brand" class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-medium text-brand">
                {t().settings.updateAvailable}: v{status().version}
              </span>
              <Button
                variant="default"
                size="sm"
                onClick={() => void desktop.invoke("updater:download")}
              >
                <Download />
                <span>{t().settings.downloadUpdate}</span>
              </Button>
            </div>
            <Show when={status().notes}>
              <ScrollView
                as="p"
                class="text-2xs text-muted-foreground whitespace-pre-wrap max-h-24"
              >
                {status().notes}
              </ScrollView>
            </Show>
          </Callout>
        )}
      </Show>

      <Show when={downloading()}>
        {(status) => (
          <Callout class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">{t().settings.downloadingUpdate}</span>
              <span class="font-mono font-medium tabular-nums">
                {formatPercent(status().percent / 100)}
              </span>
            </div>
            <Progress value={status().percent} aria-label={t().settings.downloadingUpdate}>
              <Progress.Track class="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <Progress.Fill class="h-full rounded-full bg-brand transition-[width] duration-sheet w-(--kb-progress-fill-width)" />
              </Progress.Track>
            </Progress>
          </Callout>
        )}
      </Show>

      <Show when={updateStatus().kind === "ready"}>
        <Callout variant="success" class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-success">
            <CheckCircle2 />
            <span>{t().settings.updateReady}</span>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => void desktop.invoke("updater:install")}
          >
            {t().settings.restartToApply}
          </Button>
        </Callout>
      </Show>

      <Show when={failed()}>
        {(status) => (
          <Callout variant="destructive" class="text-destructive" title={status().message}>
            {t().settings.updateErrorGeneric}
          </Callout>
        )}
      </Show>
    </>
  );
};
