import { Copy, Minus, Square, X } from "lucide-solid";
import { createSignal, onCleanup, Show, type Component } from "solid-js";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { css, cx } from "@/styled-system/css";

const controls = css({
  display: "flex",
  height: "full",
  flexShrink: 0,
  alignItems: "stretch",
});
const closeButton = css({
  display: "flex",
  width: "captionButton",
  alignItems: "center",
  justifyContent: "center",
  color: "muted.foreground",
  layerStyle: "interactive",
  _hover: { backgroundColor: "window.close", color: "window.closeForeground" },
});
const windowButton = css({
  display: "flex",
  width: "captionButton",
  alignItems: "center",
  justifyContent: "center",
  color: "muted.foreground",
  layerStyle: "interactive",
  _hover: { backgroundColor: "accent", color: "foreground" },
});
const icon = css({ width: "4", height: "4" });
const smallIcon = css({ width: "3.5", height: "3.5" });
const restoreIcon = css({ width: "3.5", height: "3.5", transform: "scaleX(-1)" });

/**
 * Minimize, maximize and close, drawn by the page for the main window on Windows and Linux,
 * where the native buttons could not hide with the title bar. Close goes through the window's
 * close event, so unsaved changes are still asked about.
 */
export const CaptionButtons: Component<{ side: "left" | "right" }> = (props) => {
  const [maximized, setMaximized] = createSignal(false);
  onCleanup(desktop.on("window:maximized-changed", setMaximized));
  const labels = () => t().window;

  const close = (
    <button
      type="button"
      aria-label={labels().close}
      title={labels().close}
      onClick={() => void desktop.invoke("window:close")}
      class={closeButton}
    >
      <X class={icon} stroke-width={1.25} />
    </button>
  );

  return (
    <div dir="ltr" class={cx("app-no-drag", controls)}>
      <Show when={props.side === "left"}>{close}</Show>
      <button
        type="button"
        aria-label={labels().minimize}
        title={labels().minimize}
        onClick={() => void desktop.invoke("window:minimize")}
        class={windowButton}
      >
        <Minus class={icon} stroke-width={1.25} />
      </button>
      <button
        type="button"
        aria-label={maximized() ? labels().restore : labels().maximize}
        title={maximized() ? labels().restore : labels().maximize}
        onClick={() => void desktop.invoke("window:toggle-maximize")}
        class={windowButton}
      >
        <Show when={maximized()} fallback={<Square class={smallIcon} stroke-width={1.25} />}>
          <Copy class={restoreIcon} stroke-width={1.25} />
        </Show>
      </button>
      <Show when={props.side === "right"}>{close}</Show>
    </div>
  );
};
