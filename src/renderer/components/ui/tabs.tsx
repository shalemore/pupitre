import { Tabs as KobalteTabs } from "@kobalte/core/tabs";
import { cn } from "cn";
import type { JSX } from "solid-js";

/**
 * Vertical tabs for the settings window sidebar. Arrow-key navigation, focus management and ARIA attributes are handled by Kobalte,
 * so this only provides the styling.
 */
export const Tabs = KobalteTabs;

export function TabsList(props: { class?: string; children: JSX.Element }) {
  return (
    <KobalteTabs.List class={cn("flex flex-col gap-1 outline-none", props.class)}>
      {props.children}
    </KobalteTabs.List>
  );
}

export function TabsTrigger(props: { value: string; children: JSX.Element }) {
  return (
    <KobalteTabs.Trigger
      value={props.value}
      class="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-start text-xs text-muted-foreground outline-none cursor-pointer transition-colors hover:bg-accent hover:text-foreground focus-visible:shadow-focus data-selected:bg-brand/10 data-selected:font-medium data-selected:text-brand"
    >
      {props.children}
    </KobalteTabs.Trigger>
  );
}

export function TabsContent(props: { value: string; children: JSX.Element }) {
  return (
    <KobalteTabs.Content value={props.value} class="outline-none">
      {props.children}
    </KobalteTabs.Content>
  );
}
