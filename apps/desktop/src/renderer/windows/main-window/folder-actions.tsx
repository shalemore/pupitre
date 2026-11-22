import { t } from "@pupitre/i18n/solid";
import { ToggleIconButton } from "@pupitre/ui";
import { Eye } from "lucide-solid";
import { Show, type Component } from "solid-js";
import { FolderSortButton } from "@/features/sidebar/folder-sort-button";

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
        variant="quiet"
        size="icon-2xs"
      >
        <Eye />
      </ToggleIconButton>
    </Show>
    <FolderSortButton onHoldOpenChange={props.onHoldOpenChange} />
  </>
);
