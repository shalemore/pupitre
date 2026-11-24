import type { UpdateStatus } from "@pupitre/desktop-api";
import { desktop } from "@pupitre/desktop-api/client";
import { t } from "@pupitre/i18n/solid";
import { Button, Callout } from "@pupitre/ui";
import { Progress, ProgressIndicator, ProgressTrack } from "@ui-sdk/solid/progress";
import { CheckCircle2, Download, RefreshCw } from "lucide-solid";
import { createMemo, Show, type Component } from "solid-js";
import { formatPercent } from "@/lib/number-format";
import { updateActionOf } from "@/lib/update-action";
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
  const action = createMemo(() => updateActionOf(updateStatus(), t().settings));
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void desktop.invoke(action().command)}
      disabled={action().disabled}
    >
      <Show
        when={action().icon === "download"}
        fallback={<RefreshCw class={action().spinning ? "animate-spin" : ""} />}
      >
        <Download />
      </Show>
      <span>{action().label}</span>
    </Button>
  );
};

export const UpdateStatusPanel: Component<{ currentVersion: string }> = (props) => {
  const upToDate = useStatus("up-to-date");
  const available = useStatus("available");
  const downloading = useStatus("downloading");
  const ready = useStatus("ready");
  const failed = useStatus("error");

  return (
    <>
      <Show when={upToDate()}>
        <Callout variant="success" class="flex items-center gap-2 text-success">
          <CheckCircle2 />
          <span>
            {t().settings.upToDate} (v{props.currentVersion})
          </span>
        </Callout>
      </Show>

      <Show when={available()}>
        {(status) => (
          <Callout variant="brand">
            <span class="font-medium text-brand">
              {t().settings.updateAvailable}: v{status().version}
            </span>
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
              <ProgressTrack class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <ProgressIndicator
                  class="h-full rounded-full bg-brand transition-[width] duration-sheet"
                  style={{ width: `${status().percent}%` }}
                />
              </ProgressTrack>
            </Progress>
          </Callout>
        )}
      </Show>

      <Show when={ready()}>
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
