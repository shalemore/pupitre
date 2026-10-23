import type { UpdateStatus } from "@shared/desktop-api";
import { cn } from "cn";
import { CheckCircle2, Download, RefreshCw } from "lucide-solid";
import { createMemo, Show, type Component } from "solid-js";
import { Button, ScrollView } from "@/components/ui";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
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
      class="text-xs"
    >
      <RefreshCw class={cn("size-3.5", updateStatus().kind === "checking" && "animate-spin")} />
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
        <div class="p-2.5 rounded-md bg-success/10 border border-success/20 text-success flex items-center gap-2 text-xs">
          <CheckCircle2 class="size-4 shrink-0" />
          <span>
            {t().settings.upToDate} (v{props.currentVersion})
          </span>
        </div>
      </Show>

      <Show when={available()}>
        {(status) => (
          <div class="p-3 rounded-md bg-brand/10 border border-brand/20 text-foreground space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <span class="font-medium text-brand">
                {t().settings.updateAvailable}: v{status().version}
              </span>
              <Button
                variant="default"
                size="sm"
                onClick={() => void desktop.invoke("updater:download")}
                class="text-xs"
              >
                <Download class="size-3.5" />
                <span>{t().settings.downloadUpdate}</span>
              </Button>
            </div>
            <Show when={status().notes}>
              <ScrollView
                as="p"
                class="text-[11px] text-muted-foreground whitespace-pre-wrap max-h-24"
              >
                {status().notes}
              </ScrollView>
            </Show>
          </div>
        )}
      </Show>

      <Show when={downloading()}>
        {(status) => (
          <div class="p-3 rounded-md bg-surface-0 border border-border space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">{t().settings.downloadingUpdate}</span>
              <span class="font-mono font-medium tabular-nums">{status().percent}%</span>
            </div>
            <div class="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                class="h-full bg-brand transition-all duration-200"
                style={{ width: `${status().percent}%` }}
              />
            </div>
          </div>
        )}
      </Show>

      <Show when={updateStatus().kind === "ready"}>
        <div class="p-3 rounded-md bg-success/10 border border-success/20 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2 text-success">
            <CheckCircle2 class="size-4 shrink-0" />
            <span>{t().settings.updateReady}</span>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => void desktop.invoke("updater:install")}
            class="text-xs"
          >
            {t().settings.restartToApply}
          </Button>
        </div>
      </Show>

      <Show when={failed()}>
        {(status) => (
          <div
            class="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs"
            title={status().message}
          >
            {t().settings.updateErrorGeneric}
          </div>
        )}
      </Show>
    </>
  );
};
