import { cn } from "cn";
import { ListTree, Folder } from "lucide-solid";
import { Show, type Component, type JSX } from "solid-js";
import { ScrollView, SegmentedControl } from "@/components/ui";
import { t } from "@/i18n";

export type SidebarMode = "outline" | "folder";

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
  class?: string;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  return (
    <aside
      data-sidebar
      class={cn(
        "w-64 h-full flex print:hidden flex-col bg-surface-0 select-none shrink-0 text-xs",
        props.class,
      )}
    >
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
        <div
          dir="auto"
          class="truncate px-4 pt-2 text-2xs font-medium text-muted-foreground"
          title={props.folderName}
        >
          {props.folderName}
        </div>
      </Show>
      {/* Both stay mounted so the expanded folders survive a switch to the outline */}
      <ScrollView class={cn("flex-1", props.mode !== "outline" && "hidden")}>
        {props.outline}
      </ScrollView>
      <ScrollView class={cn("flex-1", props.mode !== "folder" && "hidden")}>
        {props.folder}
      </ScrollView>
    </aside>
  );
};
