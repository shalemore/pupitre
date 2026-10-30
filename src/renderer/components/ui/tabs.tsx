import { Tabs as KobalteTabs } from "@kobalte/core/tabs";
import type { JSX } from "solid-js";
import { css, cx } from "@/styled-system/css";

/**
 * Vertical tabs for the settings window sidebar. Arrow-key navigation, focus management and ARIA attributes are handled by Kobalte,
 * so this only provides the styling.
 */
export const Tabs = KobalteTabs;

const list = css({ display: "flex", flexDirection: "column", gap: "1", outlineStyle: "none" });
const trigger = css({
  layerStyle: "interactive",
  display: "flex",
  width: "full",
  alignItems: "center",
  gap: "2",
  borderRadius: "md",
  paddingInline: "3",
  paddingBlock: "1.5",
  textAlign: "start",
  textStyle: "xs",
  color: "muted.foreground",
  outlineStyle: "none",
  cursor: "pointer",
  _hover: { backgroundColor: "accent", color: "foreground" },
  _focusVisible: { boxShadow: "focus" },
  "&[data-selected]": {
    backgroundColor: "selected",
    fontWeight: "medium",
    color: "foreground",
  },
  "& svg": { width: "4", height: "4", flexShrink: 0 },
});
const content = css({ outlineStyle: "none" });

export function TabsList(props: { class?: string; children: JSX.Element }) {
  return (
    <KobalteTabs.List data-slot="tabs-list" class={cx(list, props.class)}>
      {props.children}
    </KobalteTabs.List>
  );
}

export function TabsTrigger(props: { value: string; children: JSX.Element }) {
  return (
    <KobalteTabs.Trigger data-slot="tabs-trigger" value={props.value} class={trigger}>
      {props.children}
    </KobalteTabs.Trigger>
  );
}

export function TabsContent(props: { value: string; children: JSX.Element }) {
  return (
    <KobalteTabs.Content data-slot="tabs-content" value={props.value} class={content}>
      {props.children}
    </KobalteTabs.Content>
  );
}
