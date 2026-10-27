import { ArrowUpDown } from "lucide-solid";
import { createEffect, createSignal, on, onCleanup, Show, type Component } from "solid-js";
import type { MenuEntry } from "@shared/menu";
import type { Settings } from "@shared/settings";
import { IconButton } from "@/components/ui";
import { MenuPopup } from "@/features/menu/menu-popup";
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
  const [anchor, setAnchor] = createSignal<DOMRect>();
  createEffect(
    on(anchor, (place) => {
      props.onHoldOpenChange?.(place !== undefined);
      onCleanup(() => props.onHoldOpenChange?.(false));
    }),
  );

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
        aria-expanded={anchor() !== undefined}
        class="shrink-0 text-tertiary opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100"
        onClick={(event) => setAnchor(event.currentTarget.getBoundingClientRect())}
      >
        <ArrowUpDown />
      </IconButton>
      <Show when={anchor()} keyed>
        {(place) => (
          <MenuPopup
            entries={entries()}
            anchor={place}
            onSelect={(entry) => {
              setAnchor(undefined);
              const sort = SORTS.find((order) => order === entry.id);
              if (sort !== undefined) void updateSettings({ folderSort: sort });
            }}
            onClose={() => setAnchor(undefined)}
          />
        )}
      </Show>
    </>
  );
};
