import { ArrowUpDown } from "lucide-solid";
import { Show, type Component } from "solid-js";
import type { MenuEntry } from "@shared/menu";
import type { Settings } from "@shared/settings";
import { IconButton } from "@/components/ui";
import { MenuPopup } from "@/features/menu/menu-popup";
import { createMenu } from "@/features/menu/menu-state";
import { t } from "@/i18n";
import { settings, updateSettings } from "@/lib/settings";

type FolderSort = Settings["folderSort"];

/** The orders the menu offers, in the order it shows them. */
const SORTS: readonly FolderSort[] = ["name", "modified", "created"];

function labelOf(sort: FolderSort): string {
  switch (sort) {
    case "name":
      return t().sidebar.sortName;
    case "modified":
      return t().sidebar.sortModified;
    case "created":
      return t().sidebar.sortCreated;
  }
}

/**
 * The menu that orders the folder, beside its title: the order is a setting, so the main process
 * lists every folder again once it changes.
 */
export const FolderSortButton: Component<{
  /** Tells the window that a panel hangs out of the sidebar, so the immersive chrome stays put. */
  onHoldOpenChange?: (open: boolean) => void;
}> = (props) => {
  const panel = createMenu<DOMRect>({ onOpenChange: props.onHoldOpenChange });

  const entries = (): MenuEntry[] =>
    SORTS.map((sort) => ({
      type: "item",
      id: sort,
      label: labelOf(sort),
      checked: settings().folderSort === sort,
    }));

  return (
    <>
      <IconButton
        label={t().sidebar.sort}
        size="icon-2xs"
        aria-haspopup="menu"
        aria-expanded={panel.open() !== undefined}
        class="shrink-0 text-tertiary opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100"
        onClick={(event) => {
          if (panel.open() === undefined) panel.show(event.currentTarget.getBoundingClientRect());
        }}
        onPointerEnter={(event) => panel.show(event.currentTarget.getBoundingClientRect())}
        onPointerLeave={panel.leave}
      >
        <ArrowUpDown />
      </IconButton>
      <Show when={panel.shown()} keyed>
        {(place) => (
          <MenuPopup
            entries={entries()}
            anchor={place}
            closing={panel.closing()}
            onSelect={(entry) => {
              panel.close();
              const sort = SORTS.find((order) => order === entry.id);
              if (sort !== undefined) void updateSettings({ folderSort: sort });
            }}
            onClose={panel.close}
            onPointerOver={panel.cancelLeave}
            onPointerLeave={panel.leave}
          />
        )}
      </Show>
    </>
  );
};
