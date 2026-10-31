import { Combobox as KobalteCombobox } from "@kobalte/core/combobox";
import { debounce } from "@solid-primitives/scheduled";
import { CaseSensitive, Regex, WholeWord } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  type Component,
  type JSX,
  on,
  onMount,
  Show,
} from "solid-js";
import type {
  WorkspaceFileMatches,
  WorkspaceMatch,
  WorkspaceSearchOptions,
  WorkspaceSearchResponse,
} from "@shared/desktop-api";
import {
  Badge,
  Input,
  ScrollView,
  Sheet,
  ToggleIconButton,
  type ScrollViewProps,
} from "@/components/ui";
import { t } from "@/i18n";
import { FocusFirstRow, ShowFocusedRow } from "@/lib/combobox-rows";
import { desktop } from "@/lib/desktop";
import { css } from "@/styled-system/css";

const optionButton = css({
  color: "muted.foreground",
  "&[data-pressed]": { backgroundColor: "brand/15" },
});
const mark = css({ borderRadius: "xs", backgroundColor: "brand/20", color: "foreground" });
const item = css({
  layerStyle: "interactive",
  display: "flex",
  width: "full",
  cursor: "pointer",
  alignItems: "center",
  gap: "2",
  borderRadius: "md",
  paddingBlock: "1.5",
  paddingInlineEnd: "2.5",
  paddingInlineStart: "6",
  textAlign: "start",
  textStyle: "xs",
  color: "muted.foreground",
  outlineStyle: "none",
  _highlighted: { backgroundColor: "selected", fontWeight: "medium", color: "foreground" },
});
const lineNumber = css({
  width: "6",
  flexShrink: 0,
  textAlign: "end",
  textStyle: "2xs",
  color: "tertiary",
  fontVariantNumeric: "tabular-nums",
});
const matchText = css({
  minWidth: 0,
  flex: "1",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
const section = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  paddingInline: "2.5",
  paddingBlockStart: "1.5",
});
const sectionLabel = css({
  minWidth: 0,
  flex: "1",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontWeight: "medium",
});
const control = css({ display: "flex", alignItems: "center", gap: "1.5" });
const optionRow = css({ display: "flex", flexShrink: 0, alignItems: "center", gap: "0.5" });
const status = css({ paddingInline: "2.5", paddingBlock: "1.5", color: "muted.foreground" });
const statusError = css({ paddingInline: "2.5", paddingBlock: "1.5", color: "destructive" });
const countLabel = css({
  paddingInline: "2.5",
  textStyle: "2xs",
  color: "tertiary",
  fontVariantNumeric: "tabular-nums",
});
const list = css({ display: "flex", minHeight: 0, flexDirection: "column", gap: "0.5" });

/** Typing must not ask the main process for the whole folder once per keystroke. */
const SEARCH_DELAY_MS = 150;

/** One match with the index it has in the whole list, which the keyboard moves through. */
interface MatchRow {
  path: string;
  match: WorkspaceMatch;
  index: number;
}

/** A document of the folder with the matches found in it. */
interface MatchGroup {
  file: WorkspaceFileMatches;
  matches: MatchRow[];
}

export interface WorkspaceSearchProps {
  /** The folder whose documents are searched; undefined while none is open. */
  root: string | undefined;
  /** Opens the document of a match and selects the match in it. */
  onOpenMatch: (path: string, from: number, to: number) => void;
  onClose: () => void;
}

/** A match option of the bar, such as case sensitivity; pressed options are shown in the accent color. */
const OptionButton: Component<{
  pressed: boolean;
  label: string;
  onChange: (pressed: boolean) => void;
  children: JSX.Element;
}> = (props) => (
  <ToggleIconButton
    pressed={props.pressed}
    onChange={props.onChange}
    label={props.label}
    size="icon-xs"
    class={optionButton}
  >
    {props.children}
  </ToggleIconButton>
);

/** The line a match is on, with the matched part marked. */
const MatchLine: Component<{ match: WorkspaceMatch }> = (props) => {
  const end = () => props.match.column + props.match.to - props.match.from;
  return (
    <>
      {props.match.text.slice(0, props.match.column)}
      <mark class={mark}>{props.match.text.slice(props.match.column, end())}</mark>
      {props.match.text.slice(end())}
    </>
  );
};

/**
 * The matches of a query in every document of the open folder, grouped by file. A match opens its
 * document and selects itself there, so the two searches of the app meet in the same text.
 */
export const WorkspaceSearch: Component<WorkspaceSearchProps> = (props) => {
  const [query, setQuery] = createSignal("");
  const [caseSensitive, setCaseSensitive] = createSignal(false);
  const [wholeWord, setWholeWord] = createSignal(false);
  const [regexp, setRegexp] = createSignal(false);
  const [answer, setAnswer] = createSignal<WorkspaceSearchResponse>();
  let input: HTMLInputElement | undefined;

  const groups = createMemo<MatchGroup[]>(() => {
    const found = answer();
    if (found?.kind !== "ok") return [];
    let index = 0;
    return found.files.map((file) => ({
      file,
      matches: file.matches.map((match) => ({ path: file.path, match, index: index++ })),
    }));
  });
  const matchCount = createMemo(() =>
    groups().reduce((count, group) => count + group.matches.length, 0),
  );
  const noResults = () =>
    props.root !== undefined && query() !== "" && answer()?.kind === "ok" && matchCount() === 0;

  // Counts the questions asked, so that only the answer to the last one is shown
  let latest = 0;
  const search = async () => {
    const root = props.root;
    if (root === undefined || query() === "") {
      setAnswer(undefined);
      return;
    }
    const options: WorkspaceSearchOptions = {
      caseSensitive: caseSensitive(),
      wholeWord: wholeWord(),
      regexp: regexp(),
    };
    const request = ++latest;
    const found = await desktop.invoke("folder:search", root, query(), options);
    // A slower answer must not replace the one of a question asked after it
    if (request !== latest) return;
    setAnswer(found);
  };
  const searchSoon = debounce(() => void search(), SEARCH_DELAY_MS);

  createEffect(
    on([() => props.root, query, caseSensitive, wholeWord, regexp], () => searchSoon(), {
      defer: true,
    }),
  );

  // An input method commits its candidate with Enter, which must not open the match under it
  onMount(() => {
    input?.focus();
    // The key events are delegated at the document, so stopping the propagation here keeps the
    // combobox from seeing a commit Enter at all
    input?.addEventListener(
      "keydown",
      (event) => {
        if (event.isComposing) event.stopPropagation();
      },
      true,
    );
  });

  const open = (row: MatchRow) => props.onOpenMatch(row.path, row.match.from, row.match.to);

  return (
    <Sheet title={t().workspaceSearch.title} placement="top" onClose={props.onClose}>
      <KobalteCombobox<MatchRow, MatchGroup>
        open
        options={groups()}
        optionGroupChildren="matches"
        optionValue={(row) => String(row.index)}
        optionTextValue={() => ""}
        // Picking closes the sheet, and the query is what the field keeps until it does
        optionLabel={() => query()}
        defaultFilter={() => true}
        allowsEmptyCollection
        closeOnSelection={false}
        triggerMode="input"
        onInputChange={setQuery}
        onChange={(row) => {
          if (row !== null) open(row);
        }}
        itemComponent={(itemProps) => (
          <KobalteCombobox.Item item={itemProps.item} class={item}>
            <span class={lineNumber}>{itemProps.item.rawValue.match.line}</span>
            <span dir="auto" class={matchText}>
              <MatchLine match={itemProps.item.rawValue.match} />
            </span>
          </KobalteCombobox.Item>
        )}
        sectionComponent={(sectionProps) => (
          <KobalteCombobox.Section class={section}>
            <span dir="auto" class={sectionLabel}>
              {sectionProps.section.rawValue.file.relative}
            </span>
            <Badge variant="muted" size="sm">
              {sectionProps.section.rawValue.matches.length}
            </Badge>
          </KobalteCombobox.Section>
        )}
      >
        <KobalteCombobox.Control class={control}>
          <KobalteCombobox.Input
            as={Input}
            ref={(element) => (input = element)}
            dir="auto"
            placeholder={t().workspaceSearch.placeholder}
            aria-label={t().workspaceSearch.title}
          />
          <div class={optionRow}>
            <OptionButton
              pressed={caseSensitive()}
              onChange={setCaseSensitive}
              label={t().editor.matchCase}
            >
              <CaseSensitive />
            </OptionButton>
            <OptionButton
              pressed={wholeWord()}
              onChange={setWholeWord}
              label={t().editor.wholeWord}
            >
              <WholeWord />
            </OptionButton>
            <OptionButton pressed={regexp()} onChange={setRegexp} label={t().editor.useRegex}>
              <Regex />
            </OptionButton>
          </div>
        </KobalteCombobox.Control>

        <Show when={props.root === undefined}>
          <p role="status" class={status}>
            {t().workspaceSearch.noFolder}
          </p>
        </Show>
        <Show when={answer()?.kind === "invalid-regexp"}>
          <p role="status" class={statusError}>
            {t().workspaceSearch.invalidRegexp}
          </p>
        </Show>
        <Show when={noResults()}>
          <p role="status" class={status}>
            {t().workspaceSearch.noResults}
          </p>
        </Show>
        <Show when={matchCount() > 0}>
          <p role="status" class={countLabel}>
            {t().workspaceSearch.matchCount(matchCount())}
          </p>
        </Show>

        <KobalteCombobox.Listbox
          as={(listProps: ScrollViewProps) => (
            <ScrollView {...listProps} aria-label={t().workspaceSearch.title} class={list} />
          )}
        />
        <FocusFirstRow />
        <ShowFocusedRow />
      </KobalteCombobox>
    </Sheet>
  );
};
