import { type JSX, Show, splitProps } from "solid-js";
import { css, cx } from "@/styled-system/css";

export interface SettingRowProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "title"> {
  title: JSX.Element;
  description?: string | undefined;
}

const row = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "4",
  paddingBlock: "2.5",
});
const text = css({ display: "flex", minWidth: 0, flexDirection: "column", gap: "0.5" });
const title = css({ textStyle: "xs", fontWeight: "medium", color: "foreground" });
const description = css({ textStyle: "2xs", lineHeight: "relaxed", color: "muted.foreground" });
const actions = css({ display: "flex", flexShrink: 0, alignItems: "center", gap: "2" });

export function SettingRow(props: SettingRowProps) {
  const [local, rest] = splitProps(props, ["class", "title", "description", "children"]);

  return (
    <div data-slot="setting-row" class={cx(row, local.class)} {...rest}>
      <div class={text}>
        <span class={title}>{local.title}</span>
        <Show when={local.description}>
          <span class={description}>{local.description}</span>
        </Show>
      </div>
      <div class={actions}>{local.children}</div>
    </div>
  );
}
