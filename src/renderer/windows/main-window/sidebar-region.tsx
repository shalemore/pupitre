import { Show, type Component, type JSX } from "solid-js";
import { Sidebar, SidebarPanel, SidebarSlot, type SidebarMode } from "@/features/sidebar/sidebar";
import type { SidebarControl } from "@/features/sidebar/sidebar-control";
import { t } from "@/i18n";
import { fileNameOf } from "@/lib/file";
import { sidebarDivider } from "../window-chrome";

interface SidebarRegionProps {
  /** The document card, which sits between the two sidebars. */
  children: JSX.Element;
  immersive: boolean;
  split: boolean;
  startShown: boolean;
  endShown: boolean;
  startWidth: number;
  endWidth: number;
  onStartWidth: (width: number) => void;
  onEndWidth: (width: number) => void;
  startControl: SidebarControl;
  endControl: SidebarControl;
  mode: SidebarMode;
  hasOutline: boolean;
  folderRoot: string | undefined;
  folderTitleAction: JSX.Element;
  folderAction: JSX.Element;
  outline: JSX.Element;
  folderTree: (root: string) => JSX.Element;
  onModeChange: (mode: SidebarMode) => void;
}

/** The sidebars and the room they leave for the document, in the combined and the split layout. */
export const SidebarRegion: Component<SidebarRegionProps> = (props) => {
  const folderName = () => fileNameOf(props.folderRoot ?? "");
  return (
    <>
      <SidebarSlot
        side="start"
        shown={props.startShown}
        width={props.startWidth}
        onWidthChange={props.onStartWidth}
      >
        <Show
          when={props.split}
          fallback={
            <Sidebar
              class={sidebarDivider({ side: "start", classic: !props.immersive })}
              mode={props.mode}
              control={props.startControl}
              hasOutline={props.hasOutline}
              hasFolder={props.folderRoot !== undefined}
              folderName={folderName()}
              folderTitleAction={props.folderTitleAction}
              folderAction={props.folderAction}
              onModeChange={props.onModeChange}
              outline={props.outline}
              folder={
                <Show when={props.folderRoot} keyed>
                  {(root) => props.folderTree(root)}
                </Show>
              }
            />
          }
        >
          <Show when={props.folderRoot} keyed>
            {(root) => (
              <SidebarPanel
                side="start"
                title={folderName()}
                titleAction={props.folderTitleAction}
                action={props.folderAction}
                control={props.startControl}
                class={sidebarDivider({ side: "start", classic: !props.immersive })}
              >
                {props.folderTree(root)}
              </SidebarPanel>
            )}
          </Show>
        </Show>
      </SidebarSlot>

      {props.children}

      <Show when={props.split}>
        <SidebarSlot
          side="end"
          shown={props.endShown}
          width={props.endWidth}
          onWidthChange={props.onEndWidth}
        >
          <SidebarPanel
            side="end"
            title={t().sidebar.outline}
            control={props.endControl}
            class={sidebarDivider({ side: "end", classic: !props.immersive })}
          >
            {props.outline}
          </SidebarPanel>
        </SidebarSlot>
      </Show>
    </>
  );
};
