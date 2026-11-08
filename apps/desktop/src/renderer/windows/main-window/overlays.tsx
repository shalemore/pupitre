import { TableSizeDialog } from "@pupitre/plugin-source-mode";
import type { Component } from "solid-js";
import { CommandPalette } from "@/features/command-palette/command-palette";
import { QuickOpen } from "@/features/quick-open";
import { VersionHistory } from "@/features/version-history";
import { WorkspaceSearch } from "@/features/workspace-search";

/** Closing is the same for every panel, so the state that opened one carries its own close. */
type Closable<T> = T & { onClose: () => void };

/**
 * The panel that takes the window over, with what it shows and what it does. The state carries its
 * own handlers, so a panel only ever receives the fields it has a use for.
 */
export type Overlay =
  | Closable<{ kind: "palette" }>
  | Closable<{
      kind: "table-size";
      onInsert: (rows: number, columns: number) => void;
    }>
  | Closable<{
      kind: "history";
      path: string;
      onRestore: (markdown: string) => void;
    }>
  | Closable<{
      kind: "quick-open";
      root: string | undefined;
      onOpen: (path: string) => void;
    }>
  | Closable<{
      kind: "workspace-search";
      root: string | undefined;
      onOpenMatch: (path: string, from: number, to: number) => void;
    }>;

/**
 * The panel the state names. The window mounts this keyed, so a new overlay builds its panel from
 * scratch and this only has to pick one.
 */
export const Overlays: Component<{ overlay: Overlay }> = (props) => {
  const overlay = props.overlay;
  switch (overlay.kind) {
    case "palette":
      return <CommandPalette onClose={overlay.onClose} />;
    case "table-size":
      return <TableSizeDialog onInsert={overlay.onInsert} onClose={overlay.onClose} />;
    case "history":
      return (
        <VersionHistory
          path={overlay.path}
          onRestore={overlay.onRestore}
          onClose={overlay.onClose}
        />
      );
    case "quick-open":
      return <QuickOpen root={overlay.root} onOpen={overlay.onOpen} onClose={overlay.onClose} />;
    case "workspace-search":
      return (
        <WorkspaceSearch
          root={overlay.root}
          onOpenMatch={overlay.onOpenMatch}
          onClose={overlay.onClose}
        />
      );
  }
};
