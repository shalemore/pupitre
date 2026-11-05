import { Show, type Component } from "solid-js";
import { CommandPalette } from "@/features/command-palette/command-palette";
import { TableSizeDialog } from "@/features/editor/tables/table-size-dialog";
import { QuickOpen } from "@/features/quick-open";
import { VersionHistory } from "@/features/version-history";
import { WorkspaceSearch } from "@/features/workspace-search";

/** The panels that take the window over while they are open; one replaces another. */
export type Overlay = "palette" | "table-size" | "history" | "quick-open" | "workspace-search";

interface OverlaysProps {
  overlay: Overlay | undefined;
  /** The file whose versions the history shows; none when the document has no file. */
  historyPath: string | undefined;
  folderRoot: string | undefined;
  onClose: () => void;
  onCloseTable: () => void;
  onCloseSearch: () => void;
  onRestore: (markdown: string) => void;
  onInsertTable: (rows: number, columns: number) => void;
  onOpenPath: (path: string) => void;
  onOpenMatch: (path: string, from: number, to: number) => void;
}

export const Overlays: Component<OverlaysProps> = (props) => (
  <>
    <Show when={props.overlay === "palette"}>
      <CommandPalette onClose={props.onClose} />
    </Show>

    <Show when={props.overlay === "table-size"}>
      <TableSizeDialog onInsert={props.onInsertTable} onClose={props.onCloseTable} />
    </Show>

    {/* The versions belong to a file, so a document that has none has no panel to offer */}
    <Show when={props.overlay === "history" && props.historyPath}>
      {(path) => (
        <VersionHistory path={path()} onRestore={props.onRestore} onClose={props.onClose} />
      )}
    </Show>

    <Show when={props.overlay === "quick-open"}>
      <QuickOpen root={props.folderRoot} onClose={props.onClose} onOpen={props.onOpenPath} />
    </Show>

    <Show when={props.overlay === "workspace-search"}>
      <WorkspaceSearch
        root={props.folderRoot}
        onOpenMatch={props.onOpenMatch}
        onClose={props.onCloseSearch}
      />
    </Show>
  </>
);
