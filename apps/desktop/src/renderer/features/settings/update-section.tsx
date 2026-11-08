import { Progress } from "@kobalte/core/progress";
import type { UpdateStatus } from "@pupitre/desktop-api";
import { Button, Callout } from "@pupitre/ui";
import { CheckCircle2, Download, RefreshCw } from "lucide-solid";
import { createMemo, Show, type Component } from "solid-js";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { formatPercent } from "@/lib/number-format";
import { updateActionOf } from "@/lib/update-action";
import { updateStatus } from "@/lib/updater";
import { css } from "@/styled-system/css";

const spin = css({ animation: "spin" });
const stack = css({ "& > :not(:last-child)": { marginBlockEnd: "2" } });
const row = css({ display: "flex", alignItems: "center", justifyContent: "space-between" });
const inlineSuccess = css({ display: "flex", alignItems: "center", gap: "2", color: "success" });
const brandText = css({ fontWeight: "medium", color: "brand" });
const mutedText = css({ color: "muted.foreground" });
const percent = css({
  fontFamily: "mono",
  fontWeight: "medium",
  fontVariantNumeric: "tabular-nums",
});
const track = css({
  width: "full",
  height: "1.5",
  backgroundColor: "muted",
  borderRadius: "full",
  overflow: "hidden",
});
const fill = css({
  height: "full",
  borderRadius: "full",
  backgroundColor: "brand",
  transitionProperty: "width",
  transitionDuration: "sheet",
  width: "var(--kb-progress-fill-width)",
});
const destructiveText = css({ color: "destructive" });

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
        fallback={<RefreshCw class={action().spinning ? spin : ""} />}
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
        <Callout variant="success" class={inlineSuccess}>
          <CheckCircle2 />
          <span>
            {t().settings.upToDate} (v{props.currentVersion})
          </span>
        </Callout>
      </Show>

      <Show when={available()}>
        {(status) => (
          <Callout variant="brand">
            <span class={brandText}>
              {t().settings.updateAvailable}: v{status().version}
            </span>
          </Callout>
        )}
      </Show>

      <Show when={downloading()}>
        {(status) => (
          <Callout class={stack}>
            <div class={row}>
              <span class={mutedText}>{t().settings.downloadingUpdate}</span>
              <span class={percent}>{formatPercent(status().percent / 100)}</span>
            </div>
            <Progress value={status().percent} aria-label={t().settings.downloadingUpdate}>
              <Progress.Track class={track}>
                <Progress.Fill class={fill} />
              </Progress.Track>
            </Progress>
          </Callout>
        )}
      </Show>

      <Show when={ready()}>
        <Callout variant="success" class={row}>
          <div class={inlineSuccess}>
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
          <Callout variant="destructive" class={destructiveText} title={status().message}>
            {t().settings.updateErrorGeneric}
          </Callout>
        )}
      </Show>
    </>
  );
};
