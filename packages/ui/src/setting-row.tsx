import { type JSX, Show, splitProps } from "solid-js";
import { css, cx } from "./styled-system/css";

export interface SettingRowProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "title"> {
  title: JSX.Element;
  description?: JSX.Element | undefined;
  /** Draws the row as the heading of the settings under it, with its own control on the right. */
  heading?: boolean | undefined;
}

const row = css({
  display: "flex",
  minHeight: "14",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "6",
  paddingBlock: "3",
});
const text = css({ display: "flex", minWidth: "0", flexDirection: "column", gap: "1" });
const title = css({ textStyle: "xs", fontWeight: "medium", color: "foreground" });
const headingTitle = css({ textStyle: "sm", fontWeight: "semibold" });
const description = css({
  textStyle: "2xs",
  lineHeight: "relaxed",
  color: "muted.foreground",
  overflowWrap: "anywhere",
});
const actions = css({ display: "flex", flexShrink: 0, alignItems: "center", gap: "2" });

export function SettingRow(props: SettingRowProps) {
  const [local, rest] = splitProps(props, ["class", "title", "description", "heading", "children"]);

  return (
    <div data-slot="setting-row" class={cx(row, local.class)} {...rest}>
      <div class={text}>
        <Show when={local.heading} fallback={<span class={title}>{local.title}</span>}>
          <h3 class={cx(title, headingTitle)}>{local.title}</h3>
        </Show>
        <Show when={local.description}>
          <span class={description}>{local.description}</span>
        </Show>
      </div>
      <div class={actions}>{local.children}</div>
    </div>
  );
}
