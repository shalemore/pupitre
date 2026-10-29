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
    class="text-muted-foreground data-pressed:bg-brand/15"
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
      <mark class="rounded-xs bg-brand/20 text-foreground">
        {props.match.text.slice(props.match.column, end())}
      </mark>
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
          <KobalteCombobox.Item
            item={itemProps.item}
            class="flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pe-2.5 ps-6 text-start text-xs text-muted-foreground outline-none transition-colors data-highlighted:bg-selected data-highlighted:font-medium data-highlighted:text-foreground"
          >
            <span class="w-6 shrink-0 text-end text-2xs text-tertiary tabular-nums">
              {itemProps.item.rawValue.match.line}
            </span>
            <span dir="auto" class="min-w-0 flex-1 truncate">
              <MatchLine match={itemProps.item.rawValue.match} />
            </span>
          </KobalteCombobox.Item>
        )}
        sectionComponent={(sectionProps) => (
          <KobalteCombobox.Section class="flex items-center gap-1.5 px-2.5 pt-1.5">
            <span dir="auto" class="min-w-0 flex-1 truncate font-medium">
              {sectionProps.section.rawValue.file.relative}
            </span>
            <Badge variant="muted" size="sm">
              {sectionProps.section.rawValue.matches.length}
            </Badge>
          </KobalteCombobox.Section>
        )}
      >
        <KobalteCombobox.Control class="flex items-center gap-1.5">
          <KobalteCombobox.Input
            as={Input}
            ref={(element) => (input = element)}
            dir="auto"
            placeholder={t().workspaceSearch.placeholder}
            aria-label={t().workspaceSearch.title}
          />
          <div class="flex shrink-0 items-center gap-0.5">
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
          <p role="status" class="px-2.5 py-1.5 text-muted-foreground">
            {t().workspaceSearch.noFolder}
          </p>
        </Show>
        <Show when={answer()?.kind === "invalid-regexp"}>
          <p role="status" class="px-2.5 py-1.5 text-destructive">
            {t().workspaceSearch.invalidRegexp}
          </p>
        </Show>
        <Show when={noResults()}>
          <p role="status" class="px-2.5 py-1.5 text-muted-foreground">
            {t().workspaceSearch.noResults}
          </p>
        </Show>
        <Show when={matchCount() > 0}>
          <p role="status" class="px-2.5 text-2xs text-tertiary tabular-nums">
            {t().workspaceSearch.matchCount(matchCount())}
          </p>
        </Show>

        <KobalteCombobox.Listbox
          as={(listProps: ScrollViewProps) => (
            <ScrollView
              {...listProps}
              aria-label={t().workspaceSearch.title}
              class="flex min-h-0 flex-col gap-0.5"
            />
          )}
        />
        <FocusFirstRow />
        <ShowFocusedRow />
      </KobalteCombobox>
    </Sheet>
  );
};
