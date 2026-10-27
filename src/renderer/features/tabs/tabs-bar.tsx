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

/** A tab in the strip: the name, a dirty dot and a close button, over the active fill. */
function TabButton(props: TabButtonProps) {
  let element: HTMLDivElement | undefined;

  // The shortcuts and a closing neighbour can bring a tab up while it sits past the edge of the strip
  createEffect(() => {
    if (props.active) element?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  return (
    <div
      ref={(node) => (element = node)}
      class="group relative flex h-7 min-w-0 max-w-48 shrink-0 items-center border-e border-border-subtle last:border-e-0"
    >
      <button
        type="button"
        role="tab"
        aria-selected={props.active}
        title={props.name}
        onClick={props.onActivate}
        // A middle click closes the tab, as it does in every editor that has tabs
        onAuxClick={(event) => {
          if (event.button !== 1) return;
          event.preventDefault();
          props.onClose();
        }}
        class={cn(
          "flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 px-2.5 text-xs outline-none select-none transition-colors",
          props.active
            ? "bg-surface-1 text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Show when={isTabDirty(props.tab)}>
          <span aria-hidden="true" class="size-1.5 shrink-0 rounded-full bg-brand" />
        </Show>
        <bdi dir="ltr" class="min-w-0 truncate">
          {props.name}
        </bdi>
      </button>
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
 * The strip of open documents at the top of the document card. The title bar names the active tab,
 * so the strip only appears once a second document is open.
 */
export const TabsBar: Component<TabsBarProps> = (props) => (
  <div
    role="tablist"
    aria-label={t().tabs.bar}
    class="flex shrink-0 items-center overflow-x-auto border-b border-border px-1 py-1 print:hidden"
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
  </div>
);
