import { Tabs as KobalteTabs } from "@kobalte/core/tabs";
import { cn } from "cn";
import { X } from "lucide-solid";
import { createEffect, For, Show, type Component } from "solid-js";
import { IconButton } from "@/components/ui";
import { t } from "@/i18n";
import { isTabDirty, type Tab } from "@/lib/document-session";

export interface TabsBarProps {
  tabs: readonly Tab[];
  activeId: number | undefined;
  /** The name a tab shows: the file name, or the name of a document that has no file yet. */
  nameOf: (tab: Tab) => string;
  onActivate: (id: number) => void;
  onClose: (id: number) => void;
}

interface TabButtonProps {
  tab: Tab;
  name: string;
  active: boolean;
  onActivate: () => void;
  onClose: () => void;
}

/** A tab as a title bar shows it: the name, a dirty dot and a close button, over the active fill. */
function TabButton(props: TabButtonProps) {
  let element: HTMLDivElement | undefined;

  // The shortcuts and a closing neighbour can bring a tab up while it sits past the edge of the strip
  createEffect(() => {
    if (props.active) element?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  return (
    <div
      ref={(node) => (element = node)}
      class={cn(
        "group relative flex h-full min-w-0 max-w-48 shrink-0 items-center border-e border-border-subtle last:border-e-0 transition-colors",
        // The fill belongs to the whole tab: the close button is part of it, not a block beside it
        props.active ? "bg-surface-1" : "hover:bg-accent",
      )}
    >
      <KobalteTabs.Trigger
        value={String(props.tab.id)}
        title={props.name}
        onClick={() => props.onActivate()}
        onFocus={() => props.onActivate()}
        // A middle click closes the tab, as it does in every editor that has tabs
        onAuxClick={(event) => {
          if (event.button !== 1) return;
          event.preventDefault();
          props.onClose();
        }}
        class={cn(
          "flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 px-2.5 text-xs outline-none select-none",
          props.active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Show when={isTabDirty(props.tab)}>
          <span aria-hidden="true" class="size-1.5 shrink-0 rounded-full bg-brand" />
        </Show>
        <bdi dir="ltr" class="min-w-0 truncate">
          {props.name}
        </bdi>
      </KobalteTabs.Trigger>
      <IconButton
        label={t().menu.closeTab}
        size="icon-2xs"
        class={cn(
          "me-1 transition-opacity duration-fast",
          // The close button of a tab only appears while it is pointed at, or when the tab is the active one
          !props.active && "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        )}
        onClick={props.onClose}
      >
        <X />
      </IconButton>
      <Show when={props.active}>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-brand"
        />
      </Show>
    </div>
  );
}

/**
 * The open documents, in the title bar, once a second document is open. The title bar already names
 * the one document a single-tab window shows, so the strip only appears with more of them; sharing
 * the bar keeps the tabs inside the part that unfolds with the immersive chrome.
 */
export const TabsBar: Component<TabsBarProps> = (props) => (
  <KobalteTabs
    value={props.activeId === undefined ? "" : String(props.activeId)}
    class="flex h-full min-w-0 flex-1 items-stretch"
  >
    <KobalteTabs.List
      aria-label={t().tabs.bar}
      // The strip scrolls sideways when the tabs overflow; the wheel follows the row, since a
      // vertical wheel over it has nothing else to do, and the scrollbar only appears when needed
      onWheel={(event) => {
        const strip = event.currentTarget;
        if (strip.scrollWidth <= strip.clientWidth) return;
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        event.preventDefault();
        strip.scrollLeft += event.deltaY;
      }}
      class="flex h-full min-w-0 flex-1 items-stretch overflow-x-auto overscroll-x-contain print:hidden"
    >
      <For each={props.tabs}>
        {(tab) => (
          <TabButton
            tab={tab}
            name={props.nameOf(tab)}
            active={tab.id === props.activeId}
            onActivate={() => props.onActivate(tab.id)}
            onClose={() => props.onClose(tab.id)}
          />
        )}
      </For>
    </KobalteTabs.List>
  </KobalteTabs>
);
