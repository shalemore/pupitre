import { t } from "@pupitre/i18n/solid";
import { IconButton, ToggleIconButton } from "@pupitre/ui";
import { quietButton, rtlFlip } from "@pupitre/ui/styles";
import { CornerRightUp, Eye } from "lucide-solid";
import { Show, type Component } from "solid-js";
import { FolderSortButton } from "@/features/sidebar/folder-sort-button";
import { parentFolder } from "@/lib/file";

interface ParentFolderButtonProps {
  /** The folder the sidebar shows; absent while no folder is open. */
  root: string | undefined;
  /** Whether the host can move up the tree at all. */
  canGoUp: boolean;
  onGoUp: (path: string) => void;
}

/** The button up to the folder that holds the one on show, right beside its name. */
export const ParentFolderButton: Component<ParentFolderButtonProps> = (props) => {
  const parent = () => (props.root === undefined ? undefined : parentFolder(props.root));
  return (
    <Show when={props.canGoUp ? parent() : undefined}>
      {(path) => (
        <IconButton
          label={t().sidebar.parentFolder}
          size="icon-2xs"
          class={quietButton}
          onClick={() => props.onGoUp(path())}
        >
          <CornerRightUp class={rtlFlip} />
        </IconButton>
      )}
    </Show>
  );
};

interface FolderActionsProps {
  /** Whether a level on show holds an entry the eye could reveal. */
  hasHidden: boolean;
  showHidden: boolean;
  onShowHiddenChange: (show: boolean) => void;
  onHoldOpenChange: (held: boolean) => void;
}

/** The eye that reveals hidden entries, and the folder's order menu, at the far end of its title. */
export const FolderActions: Component<FolderActionsProps> = (props) => (
  <>
    <Show when={props.hasHidden}>
      <ToggleIconButton
        pressed={props.showHidden}
        onChange={props.onShowHiddenChange}
        label={t().settings.showHidden}
        size="icon-2xs"
        class={quietButton}
      >
        <Eye />
      </ToggleIconButton>
    </Show>
    <FolderSortButton onHoldOpenChange={props.onHoldOpenChange} />
  </>
);
