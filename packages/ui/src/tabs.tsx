import type { JSX } from "@solidjs/web";
import {
  Tabs as UiTabs,
  TabsList as UiTabsList,
  TabsPanel,
  TabsTab,
  type TabsOrientation,
} from "@ui-sdk/solid/tabs";
import { css, cx } from "./styled-system/css";

export interface TabsProps {
  value?: string | null | undefined;
  defaultValue?: string | null | undefined;
  onValueChange?: (value: string | null) => void;
  orientation?: TabsOrientation;
  class?: string | undefined;
  children: JSX.Element;
}

/**
 * Vertical tabs for the settings window sidebar. Arrow-key navigation, focus management and ARIA
 * attributes are handled by UI SDK, so this only provides the styling.
 */
export function Tabs(props: TabsProps) {
  return (
    <UiTabs
      value={props.value}
      defaultValue={props.defaultValue}
      onValueChange={props.onValueChange ? (value) => props.onValueChange?.(value) : undefined}
      orientation={props.orientation ?? "horizontal"}
      class={props.class}
    >
      {props.children}
    </UiTabs>
  );
}

const list = css({ display: "flex", flexDirection: "column", gap: "0.5", outlineStyle: "none" });
const trigger = css({
  layerStyle: "interactive",
  display: "flex",
  width: "full",
  alignItems: "center",
  gap: "2.5",
  borderRadius: "md",
  paddingInline: "2.5",
  paddingBlock: "2",
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
  return <UiTabsList class={cx(list, props.class)}>{props.children}</UiTabsList>;
}

export function TabsTrigger(props: { value: string; children: JSX.Element }) {
  return (
    <TabsTab value={props.value} class={trigger}>
      {props.children}
    </TabsTab>
  );
}

export function TabsContent(props: { value: string; children: JSX.Element }) {
  return (
    <TabsPanel value={props.value} class={content}>
      {props.children}
    </TabsPanel>
  );
}
