import { t } from "@pupitre/i18n/solid";
import { fileNameOf } from "@pupitre/utils";
import { Show, type Component, type JSX } from "solid-js";
import {
  Sidebar,
  SidebarPanel,
  SidebarSlot,
  type SidebarMode,
  type SidebarRail,
} from "@/features/sidebar/sidebar";
import type { SidebarControl } from "@/features/sidebar/sidebar-control";
import { sidebarDivider } from "@/windows/window-chrome";

interface SidebarRegionProps {
  /** The document card, which sits between the two sidebars. */
  children: JSX.Element;
  immersive: boolean;
  split: boolean;
  startShown: boolean;
  endShown: boolean;
  startWidth: number;
  endWidth: number;
  startMaxWidth: number;
  endMaxWidth: number;
  onStartWidth: (width: number) => void;
  onEndWidth: (width: number) => void;
  startControl: SidebarControl;
  endControl: SidebarControl;
  startRail: SidebarRail | undefined;
  endRail: SidebarRail | undefined;
  mode: SidebarMode;
  hasOutline: boolean;
  folderRoot: string | undefined;
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
        maxWidth={props.startMaxWidth}
        label={t().sidebar.folder}
        onWidthChange={props.onStartWidth}
        rail={props.startRail}
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
          maxWidth={props.endMaxWidth}
          label={t().sidebar.outline}
          onWidthChange={props.onEndWidth}
          rail={props.endRail}
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
