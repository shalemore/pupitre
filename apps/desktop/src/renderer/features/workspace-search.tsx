import type {
  WorkspaceFileMatches,
  WorkspaceMatch,
  WorkspaceSearchOptions,
  WorkspaceSearchResponse,
} from "@pupitre/desktop-api";
import { desktop } from "@pupitre/desktop-api/client";
import { t } from "@pupitre/i18n/solid";
import { Badge, Input, ScrollView, Sheet, ToggleIconButton } from "@pupitre/ui";
import { debounce } from "@pupitre/utils";
import type { JSX } from "@solidjs/web";
import {
  Command,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ui-sdk/solid/command";
import { CaseSensitive, Regex, WholeWord } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onSettled,
  Show,
  type Component,
} from "solid-js";

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
  // A press on the toggle must not take the focus from the query
  <span class="flex" onMouseDown={(event) => event.preventDefault()}>
    <ToggleIconButton
      pressed={props.pressed}
      onChange={props.onChange}
      label={props.label}
      size="icon-xs"
      class="text-muted-foreground data-pressed:bg-brand/15"
    >
      {props.children}
    </ToggleIconButton>
  </span>
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
  const rowByIndex = createMemo(() => groups().flatMap((group) => group.matches));
  const matchCount = createMemo(() => rowByIndex().length);
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
    () => [props.root, query(), caseSensitive(), wholeWord(), regexp()] as const,
    () => searchSoon(),
    { defer: true },
  );

  // An input method commits its candidate with Enter, which must not open the match under it
  onSettled(() => {
    input?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) event.stopPropagation();
    };
    input?.addEventListener("keydown", onKeyDown, true);
    return () => input?.removeEventListener("keydown", onKeyDown, true);
  });

  const open = (row: MatchRow) => props.onOpenMatch(row.path, row.match.from, row.match.to);

  return (
    <Sheet title={t().workspaceSearch.title} placement="top" onClose={props.onClose}>
      <Command
        filter={() => true}
        query={query()}
        onQueryChange={(next) => setQuery(next)}
        onAction={(value) => {
          const row = rowByIndex()[Number(value)];
          if (row !== undefined) open(row);
        }}
      >
        <div class="flex items-center gap-1.5">
          <CommandInput
            render={(inputProps) => (
              <Input
                {...inputProps}
                ref={(element) => {
                  input = element;
                  const partRef = inputProps["ref"];
                  if (typeof partRef === "function") partRef(element);
                }}
                dir="auto"
                placeholder={t().workspaceSearch.placeholder}
                aria-label={t().workspaceSearch.title}
              />
            )}
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
        </div>

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

        <CommandList
          render={(listProps) => (
            <ScrollView
              {...listProps}
              aria-label={t().workspaceSearch.title}
              class="mt-2 flex max-h-80 min-h-0 flex-col gap-0.5"
            />
          )}
        >
          <For each={groups()}>
            {(group) => (
              <CommandGroup>
                <CommandGroupLabel class="flex items-center gap-1.5 px-2.5 pt-1.5">
                  <span dir="auto" class="min-w-0 flex-1 truncate font-medium">
                    {group.file.relative}
                  </span>
                  <Badge variant="muted" size="sm">
                    {group.matches.length}
                  </Badge>
                </CommandGroupLabel>
                <For each={group.matches}>
                  {(matchRow) => (
                    <CommandItem
                      value={String(matchRow.index)}
                      class="__INTERACTIVE__ flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 ps-6 pe-2.5 text-start text-xs text-muted-foreground outline-none data-highlighted:bg-selected data-highlighted:font-medium data-highlighted:text-foreground"
                    >
                      <span class="w-6 shrink-0 text-end text-2xs text-tertiary tabular-nums">
                        {matchRow.match.line}
                      </span>
                      <span dir="auto" class="min-w-0 flex-1 truncate">
                        <MatchLine match={matchRow.match} />
                      </span>
                    </CommandItem>
                  )}
                </For>
              </CommandGroup>
            )}
          </For>
        </CommandList>
      </Command>
    </Sheet>
  );
};
