import { createMemo, createResource, For, type Component } from "solid-js";
import type { FolderFile } from "@shared/desktop-api";
import { PaletteSheet } from "@/components/palette-sheet";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { matchRanges, type MatchRange } from "@/lib/fuzzy";
import { dim, truncateGrow } from "@/lib/styles";
import { css, cx } from "@/styled-system/css";

export interface QuickOpenProps {
  /** The folder whose documents are offered; there is nothing to offer while none is open. */
  root: string | undefined;
  onClose: () => void;
  onOpen: (path: string) => void;
}

/** A document the query picked, with what it matched so the row can show it. */
interface FoundFile extends FolderFile {
  ranges: readonly MatchRange[];
}

/**
 * How many rows are drawn. A folder can hold thousands of documents, and a query that picks them
 * all would spend more time building rows nobody reads than it takes to type another character.
 */
const ROWS_SHOWN = 100;

/** The documents a query picks, in the order the folder walk gave them. */
function findFiles(files: readonly FolderFile[], query: string): FoundFile[] {
  const needle = query.trim();
  const found: FoundFile[] = [];
  for (const file of files) {
    if (found.length === ROWS_SHOWN) break;
    const ranges = matchRanges(file.relative, needle);
    if (ranges !== undefined) found.push({ ...file, ranges });
  }
  return found;
}

interface MatchedTextProps {
  text: string;
  /** What the query matched, in the offsets of the whole relative path. */
  ranges: readonly MatchRange[];
  /** Where this piece starts in the relative path. */
  offset: number;
}

/** A piece of a path with the characters the query found, so a row shows what it matched. */
const MatchedText: Component<MatchedTextProps> = (props) => {
  const pieces = createMemo(() => {
    const found: { text: string; matched: boolean }[] = [];
    let at = 0;
    for (const range of props.ranges) {
      const from = Math.max(range.from - props.offset, at);
      const to = Math.min(range.to - props.offset, props.text.length);
      if (to <= from) continue;
      if (from > at) found.push({ text: props.text.slice(at, from), matched: false });
      found.push({ text: props.text.slice(from, to), matched: true });
      at = to;
    }
    if (at < props.text.length) found.push({ text: props.text.slice(at), matched: false });
    return found;
  });

  return (
    <For each={pieces()}>
      {(piece) => (piece.matched ? <span class={matched}>{piece.text}</span> : piece.text)}
    </For>
  );
};

const matched = css({ color: "brand", fontWeight: "semibold" });
const folderGap = css({ marginInlineStart: "2" });

const QuickOpenRow: Component<{ file: FoundFile }> = (props) => {
  const name = createMemo(() => {
    const { relative } = props.file;
    return relative.slice(relative.lastIndexOf("/") + 1);
  });
  // The folder the document sits in, kept with its separator so the row reads as a path
  const folder = createMemo(() =>
    props.file.relative.slice(0, props.file.relative.length - name().length),
  );

  return (
    <span dir="auto" class={truncateGrow}>
      <MatchedText text={name()} ranges={props.file.ranges} offset={folder().length} />
      <span class={cx(dim, folderGap)}>
        <MatchedText text={folder()} ranges={props.file.ranges} offset={0} />
      </span>
    </span>
  );
};

/** Every document of the open folder, found by typing part of its path, opened where it was picked. */
export function QuickOpen(props: QuickOpenProps) {
  const [files] = createResource(
    () => props.root,
    (root) => desktop.invoke("folder:files", root),
  );

  // What an empty list means: a folder to open, a miss, or documents still on their way
  const emptyMessage = () => {
    if (props.root === undefined) return t().quickOpen.noFolder;
    if (files() === undefined) return undefined;
    return t().quickOpen.noResults;
  };

  return (
    <PaletteSheet
      title={t().quickOpen.title}
      placeholder={t().quickOpen.placeholder}
      rows={(query) => findFiles(files() ?? [], query)}
      emptyMessage={emptyMessage()}
      onPick={(file) => props.onOpen(file.path)}
      onClose={props.onClose}
    >
      {(file) => <QuickOpenRow file={file} />}
    </PaletteSheet>
  );
}
