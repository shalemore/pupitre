import { cn } from "cn";
import { ListTree, Folder } from "lucide-solid";
import { Show, type Component, type JSX } from "solid-js";
import { ScrollView, SegmentedControl } from "@/components/ui";
import { t } from "@/i18n";

export type SidebarMode = "outline" | "folder";

/** The window edge a sidebar sits at; the immersive window folds each one towards its own edge. */
export type SidebarSide = "start" | "end";

/** Collapsing animates the width and the document takes the freed room; inert keeps a hidden sidebar out of the tab order. */
export const SidebarSlot: Component<{ shown: boolean; children: JSX.Element }> = (props) => (
  <div
    inert={!props.shown}
    class={cn(
      "shrink-0 overflow-hidden transition-[width] duration-sheet print:hidden",
      props.shown ? "w-64" : "w-0",
    )}
  >
    {props.children}
  </div>
);

const SidebarFrame: Component<{
  side: SidebarSide;
  class?: string | undefined;
  children: JSX.Element;
}> = (props) => (
  <aside
    data-sidebar={props.side}
    class={cn(
      "w-64 h-full flex print:hidden flex-col bg-surface-0 select-none shrink-0 text-xs",
      props.class,
    )}
  >
    {props.children}
  </aside>
);

const SidebarTitle: Component<{ title: string }> = (props) => (
  <div
    dir="auto"
    class="truncate px-4 pt-2 text-2xs font-medium text-muted-foreground"
    title={props.title}
  >
    {props.title}
  </div>
);

/** A sidebar that holds one list, such as the outline or a folder, under its title. */
export const SidebarPanel: Component<{
  side: SidebarSide;
  title: string;
  class?: string | undefined;
  children: JSX.Element;
}> = (props) => (
  <SidebarFrame side={props.side} class={props.class}>
    <SidebarTitle title={props.title} />
    <ScrollView class="flex-1">{props.children}</ScrollView>
  </SidebarFrame>
);

interface SidebarProps {
  mode: SidebarMode;
  /** Which modes can be shown now; the switch appears only when both can. */
  hasOutline: boolean;
  hasFolder: boolean;
  /** Name of the folder shown in folder mode. */
  folderName: string;
  onModeChange: (mode: SidebarMode) => void;
  outline: JSX.Element;
  folder: JSX.Element;
  class?: string | undefined;
}

/** One sidebar with the outline and the folder as tabs, for the combined layout. */
export const Sidebar: Component<SidebarProps> = (props) => {
  return (
    <SidebarFrame side="start" class={props.class}>
      <Show when={props.hasOutline && props.hasFolder}>
        <SegmentedControl<SidebarMode>
          class="m-2 mb-0"
          value={props.mode}
          onChange={props.onModeChange}
          options={[
            { value: "outline", label: t().sidebar.outline, icon: <ListTree /> },
            { value: "folder", label: t().sidebar.folder, icon: <Folder /> },
          ]}
        />
      </Show>
      <Show when={props.mode === "folder"}>
        <SidebarTitle title={props.folderName} />
      </Show>
      {/* Both stay mounted so the expanded folders survive a switch to the outline */}
      <ScrollView class={cn("flex-1", props.mode !== "outline" && "hidden")}>
        {props.outline}
      </ScrollView>
      <ScrollView class={cn("flex-1", props.mode !== "folder" && "hidden")}>
        {props.folder}
      </ScrollView>
    </SidebarFrame>
  );
};
