import { type Component, createMemo, createResource } from "solid-js";
import type { HistoryEntry } from "@shared/desktop-api";
import { PaletteSheet } from "@/features/palette/palette-sheet";
import { currentLocale, intlLocale, t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { formatNumber } from "@/lib/format";

export interface VersionHistoryProps {
  /** The file whose kept versions are listed. */
  path: string;
  /** Puts the text of one version back into the editor, as an edit the reader can undo. */
  onRestore: (markdown: string) => void;
  onClose: () => void;
}

/** A version with the time it was overwritten, which is what its row reads. */
interface VersionRow {
  entry: HistoryEntry;
  time: string;
}

/** A size in the units the language of the window writes, so a row needs no words of its own. */
function sizeOf(bytes: number): string {
  const unit = bytes < 1000 ? "byte" : bytes < 1_000_000 ? "kilobyte" : "megabyte";
  const value = unit === "byte" ? bytes : unit === "kilobyte" ? bytes / 1000 : bytes / 1_000_000;
  return formatNumber(value, {
    style: "unit",
    unit,
    // Narrow units are symbols: "27B", "4.2kB". Their short forms take a plural the numbers a
    // version history holds would get wrong in some languages ("27 byte")
    unitDisplay: "narrow",
    maximumFractionDigits: 1,
  });
}

/**
 * The versions a document had before its file was written over, newest first. Picking one puts its
 * text back into the editor; nothing on disk changes until the document is saved again.
 */
export const VersionHistory: Component<VersionHistoryProps> = (props) => {
  // Asked once, when the panel opens: what a save adds while it is open belongs to its next opening
  const [versions] = createResource(
    () => props.path,
    (path) => desktop.invoke("history:list", path),
  );
  const timeFormat = createMemo(
    () =>
      new Intl.DateTimeFormat(intlLocale(currentLocale()), {
        dateStyle: "medium",
        timeStyle: "short",
      }),
  );
  const rows = createMemo(() =>
    (versions() ?? []).map((entry): VersionRow => ({
      entry,
      time: timeFormat().format(entry.savedAt),
    })),
  );

  // The query reaches the rows by the time they show, which is the only thing in them to search by
  const matching = (query: string): VersionRow[] => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return rows();
    return rows().filter((row) => row.time.toLowerCase().includes(needle));
  };

  const restore = (row: VersionRow) => {
    void desktop.invoke("history:read", props.path, row.entry.id).then((markdown) => {
      // The version was taken away since the panel was opened
      if (markdown !== null) props.onRestore(markdown);
    });
  };

  return (
    <PaletteSheet
      title={t().history.title}
      placeholder={t().history.filterPlaceholder}
      rows={matching}
      // Nothing is listed before the host answers, so an empty list here really is no history
      emptyMessage={versions.loading ? undefined : t().history.empty}
      // With no version to pick, there is nothing the hint could tell about picking one
      hint={rows().length === 0 ? undefined : t().history.restoreHint}
      onPick={restore}
      onClose={props.onClose}
    >
      {(row) => (
        <>
          <span class="min-w-0 flex-1 truncate">{row.time}</span>
          <span class="shrink-0 tabular-nums opacity-60">{sizeOf(row.entry.bytes)}</span>
        </>
      )}
    </PaletteSheet>
  );
};
