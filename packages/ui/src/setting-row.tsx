import type { JSX } from "@solidjs/web";
import { omit, Show } from "solid-js";
import { css, cx } from "./styled-system/css";

export interface SettingRowProps extends Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "title" | "class"
> {
  title: JSX.Element;
  description?: JSX.Element | undefined;
  /** Draws the row as the heading of the settings under it, with its own control on the right. */
  heading?: boolean | undefined;
  class?: string | undefined;
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
  const rest = omit(props, "class", "title", "description", "heading", "children");

  return (
    <div data-slot="setting-row" class={cx(row, props.class)} {...rest}>
      <div class={text}>
        <Show when={props.heading} fallback={<span class={title}>{props.title}</span>}>
          <h3 class={cx(title, headingTitle)}>{props.title}</h3>
        </Show>
        <Show when={props.description}>
          <span class={description}>{props.description}</span>
        </Show>
      </div>
      <div class={actions}>{props.children}</div>
    </div>
  );
}
