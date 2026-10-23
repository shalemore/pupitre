import { cn } from "cn";
import { ListTree, Folder } from "lucide-solid";
import { Show, type Component, type JSX } from "solid-js";
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
        "w-64 h-full flex print:hidden flex-col bg-surface-0 border-e border-border/80 select-none shrink-0 text-xs",
        props.class,
      )}
    >
      <Show when={props.hasOutline && props.hasFolder}>
        <div class="flex gap-1 p-2 pb-0">
          <button
            type="button"
            class={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md py-1 cursor-pointer transition-colors",
              props.mode === "outline"
                ? "bg-brand/10 text-brand font-medium"
                : "text-muted-foreground hover:bg-accent",
            )}
            onClick={() => props.onModeChange("outline")}
          >
            <ListTree class="size-3.5" />
            {t().sidebar.outline}
          </button>
          <button
            type="button"
            class={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md py-1 cursor-pointer transition-colors",
              props.mode === "folder"
                ? "bg-brand/10 text-brand font-medium"
                : "text-muted-foreground hover:bg-accent",
            )}
            onClick={() => props.onModeChange("folder")}
          >
            <Folder class="size-3.5" />
            {t().sidebar.folder}
          </button>
        </div>
      </Show>
      <Show when={props.mode === "folder"}>
        <div
          dir="auto"
          class="truncate px-4 pt-2 text-[11px] font-medium text-muted-foreground"
          title={props.folderName}
        >
          {props.folderName}
        </div>
      </Show>
      {/* Both stay mounted so the expanded folders survive a switch to the outline */}
      <div class={cn("flex-1 overflow-y-auto", props.mode !== "outline" && "hidden")}>
        {props.outline}
      </div>
      <div class={cn("flex-1 overflow-y-auto", props.mode !== "folder" && "hidden")}>
        {props.folder}
      </div>
    </aside>
  );
};
