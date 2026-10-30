import { FilePlus, FolderOpen } from "lucide-solid";
import { For, Show, type Component } from "solid-js";
import { Button, Kbd, ListItem } from "@/components/ui";
import { t } from "@/i18n";
import { desktop, isMacOS } from "@/lib/desktop";
import { fileNameOf } from "@/lib/file";
import { css, cx } from "@/styled-system/css";
import { LookChooser } from "./look-chooser";

interface WelcomeScreenProps {
  recentFiles: readonly string[];
  onNewDocument: () => void;
  onOpenFile: () => void;
  onOpenRecent: (path: string) => void;
}

const modifier = isMacOS ? "⌘" : "Ctrl+";
/** The menus list every recent file; the welcome screen keeps a short reminder of them. */
const RECENT_FILES_SHOWN = 5;

const screen = css({
  height: "full",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  userSelect: "none",
  paddingInline: "4",
  paddingBlock: "12",
  animationName: "fadeIn",
  animationDuration: "sheet",
  animationTimingFunction: "enter",
});
const logo = css({
  width: "14",
  height: "14",
  userSelect: "none",
  marginBlockEnd: "4",
  opacity: 0.9,
  filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.15))",
});
const title = css({
  textStyle: "xl",
  fontWeight: "semibold",
  letterSpacing: "-0.025em",
  color: "foreground",
  marginBlockEnd: "6",
});
const actions = css({
  display: "flex",
  alignItems: "center",
  gap: "3",
  marginBlockEnd: "8",
});
const recentList = css({
  width: "full",
  maxWidth: "sm",
  display: "flex",
  flexDirection: "column",
  gap: "0.5",
  textAlign: "start",
  marginBlockEnd: "6",
});
const recentLabel = css({
  textStyle: "2xs",
  fontWeight: "medium",
  color: "muted.foreground",
  paddingInline: "2.5",
  marginBlockEnd: "1",
});
const recentItem = css({
  justifyContent: "space-between",
  gap: "2",
  paddingInlineStart: "2.5",
});
const recentName = css({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontWeight: "medium",
  color: "foreground",
  layerStyle: "interactive",
  _groupHover: { color: "brand" },
});
const recentPath = css({
  textStyle: "2xs",
  fontFamily: "mono",
  color: "tertiary",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: "40",
});
const hint = css({ textStyle: "2xs", color: "tertiary" });
const actionIcon = css({ width: "3.5", height: "3.5" });
const shortcut = css({ marginInlineStart: "1" });

export const WelcomeScreen: Component<WelcomeScreenProps> = (props) => {
  return (
    <div data-slot="welcome" class={screen}>
      <img src="./logo.svg" alt="" class={logo} />

      <h1 class={title}>{t().common.appName}</h1>

      <Show when={desktop.initialState.firstRun}>
        <LookChooser />
      </Show>

      <div class={actions}>
        <Button variant="brand" onClick={props.onNewDocument}>
          <FilePlus class={actionIcon} />
          <span>{t().actions.newDoc}</span>
          <Kbd class={shortcut}>{modifier}N</Kbd>
        </Button>

        <Button variant="outline" onClick={props.onOpenFile}>
          <FolderOpen class={actionIcon} />
          <span>{t().actions.openDoc}</span>
          <Kbd class={shortcut}>{modifier}O</Kbd>
        </Button>
      </div>

      <Show when={props.recentFiles.length > 0}>
        <div class={recentList}>
          <span class={recentLabel}>{t().menu.openRecent}</span>
          <For each={props.recentFiles.slice(0, RECENT_FILES_SHOWN)}>
            {(path) => (
              <ListItem
                onClick={() => props.onOpenRecent(path)}
                title={path}
                class={cx("group", recentItem)}
              >
                <span class={recentName}>
                  <bdi dir="ltr">{fileNameOf(path)}</bdi>
                </span>
                <span dir="ltr" class={recentPath}>
                  {path}
                </span>
              </ListItem>
            )}
          </For>
        </div>
      </Show>

      <p class={hint}>{t().welcome.dragDropHint}</p>
    </div>
  );
};
