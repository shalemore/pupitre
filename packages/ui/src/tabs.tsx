import type { JSX } from "@solidjs/web";
import {
  Tabs as UiTabs,
  TabsList as UiTabsList,
  TabsPanel,
  TabsTab,
  type TabsOrientation,
} from "@ui-sdk/solid/tabs";
import { cn } from "cn";

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
  const orientation = () => props.orientation ?? "horizontal";

  return (
    <UiTabs
      value={props.value}
      defaultValue={props.defaultValue}
      onValueChange={props.onValueChange}
      orientation={orientation()}
      class={props.class}
    >
      {props.children}
    </UiTabs>
  );
}

export function TabsList(props: { class?: string; children: JSX.Element }) {
  return (
    <UiTabsList class={cn("flex flex-col gap-0.5 outline-none", props.class)}>
      {props.children}
    </UiTabsList>
  );
}

export function TabsTrigger(props: { value: string; children: JSX.Element }) {
  return (
    <TabsTab
      value={props.value}
      class="interactive flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-xs text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:shadow-focus data-[selected]:bg-selected data-[selected]:font-medium data-[selected]:text-foreground [&>svg]:size-4 [&>svg]:shrink-0"
    >
      {props.children}
    </TabsTab>
  );
}

export function TabsContent(props: { value: string; children: JSX.Element }) {
  return (
    <TabsPanel value={props.value} class="outline-none">
      {props.children}
    </TabsPanel>
  );
}
