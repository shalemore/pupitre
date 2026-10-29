import { debounce } from "@solid-primitives/scheduled";
import { cn } from "cn";
import { CaseSensitive, Regex, WholeWord } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
  type Component,
  type JSX,
} from "solid-js";
import type {
  WorkspaceMatch,
  WorkspaceSearchOptions,
  WorkspaceSearchResponse,
} from "@shared/desktop-api";
import { Badge, Button, Input, ListItem, ScrollView, Sheet } from "@/components/ui";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { createListNavigation } from "@/lib/list-navigation";

/** Typing must not ask the main process for the whole folder once per keystroke. */
const SEARCH_DELAY_MS = 150;

/** The list the input points at, which keeps the results reachable while the input holds the focus. */
const LISTBOX_ID = "workspace-search-list";

function optionId(index: number): string {
  return `workspace-search-option-${index}`;
}

/** One match with the index it has in the whole list, which the arrow keys move through. */
interface ResultRow {
  path: string;
  match: WorkspaceMatch;
  index: number;
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
  <Button
    variant="ghost"
    size="icon-xs"
    aria-pressed={props.pressed}
    title={props.label}
    aria-label={props.label}
    onClick={() => props.onChange(!props.pressed)}
    class={cn("text-muted-foreground", props.pressed && "bg-brand/15 text-brand")}
  >
    {props.children}
  </Button>
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
  let list: HTMLDivElement | undefined;

  const groups = createMemo(() => {
    const found = answer();
    if (found?.kind !== "ok") return [];
    let index = 0;
    return found.files.map((file) => ({
      file,
      matches: file.matches.map((match) => ({ match, index: index++ })),
    }));
  });
  const rows = createMemo(() =>
    groups().flatMap((group) =>
      group.matches.map(({ match, index }): ResultRow => ({ path: group.file.path, match, index })),
    ),
  );
  const navigation = createListNavigation(
    () => rows().length,
    () => list,
  );
  const active = navigation.active;
  const isActive = navigation.isActive;
  const noResults = () =>
    props.root !== undefined && query() !== "" && answer()?.kind === "ok" && rows().length === 0;

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
    navigation.reset();
  };
  const searchSoon = debounce(() => void search(), SEARCH_DELAY_MS);
  onCleanup(() => searchSoon.clear());

  createEffect(
    on([() => props.root, query, caseSensitive, wholeWord, regexp], () => searchSoon(), {
      defer: true,
    }),
  );

  onMount(() => input?.focus());

  const open = (row: ResultRow) => props.onOpenMatch(row.path, row.match.from, row.match.to);

  return (
    <Sheet
      title={t().workspaceSearch.title}
      placement="top"
      onClose={props.onClose}
      onKeyDown={(event) =>
        navigation.onKeyDown(event, {
          pick: (index) => {
            const row = rows()[index];
            if (row !== undefined) open(row);
          },
          close: props.onClose,
        })
      }
    >
      <div class="flex items-center gap-1.5">
        <Input
          ref={(element) => (input = element)}
          dir="auto"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
          placeholder={t().workspaceSearch.placeholder}
          aria-label={t().workspaceSearch.title}
          role="combobox"
          aria-expanded={true}
          aria-controls={LISTBOX_ID}
          aria-autocomplete="list"
          aria-activedescendant={rows().length > 0 ? optionId(active()) : undefined}
        />
        <div class="flex shrink-0 items-center gap-0.5">
          <OptionButton
            pressed={caseSensitive()}
            onChange={setCaseSensitive}
            label={t().editor.matchCase}
          >
            <CaseSensitive />
          </OptionButton>
          <OptionButton pressed={wholeWord()} onChange={setWholeWord} label={t().editor.wholeWord}>
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
      <Show when={rows().length > 0}>
        <p role="status" class="px-2.5 text-2xs text-tertiary tabular-nums">
          {t().workspaceSearch.matchCount(rows().length)}
        </p>
      </Show>

      <ScrollView
        ref={(element) => (list = element)}
        id={LISTBOX_ID}
        role="listbox"
        aria-label={t().workspaceSearch.title}
        class="flex min-h-0 flex-col gap-0.5"
      >
        <For each={groups()}>
          {(group) => (
            <div role="presentation" class="flex flex-col gap-0.5">
              <div class="flex items-center gap-1.5 px-2.5 pt-1.5">
                <span dir="auto" class="min-w-0 flex-1 truncate font-medium">
                  {group.file.relative}
                </span>
                <Badge variant="muted" size="sm">
                  {group.matches.length}
                </Badge>
              </div>
              <For each={group.matches}>
                {(row) => (
                  <ListItem
                    id={optionId(row.index)}
                    data-index={row.index}
                    role="option"
                    aria-selected={isActive(row.index)}
                    active={isActive(row.index)}
                    tabIndex={-1}
                    onPointerEnter={() => navigation.pointAt(row.index)}
                    onClick={() => open({ path: group.file.path, ...row })}
                    class="gap-2 ps-6"
                  >
                    <span class="w-6 shrink-0 text-end text-2xs text-tertiary tabular-nums">
                      {row.match.line}
                    </span>
                    <span dir="auto" class="min-w-0 flex-1 truncate">
                      <MatchLine match={row.match} />
                    </span>
                  </ListItem>
                )}
              </For>
            </div>
          )}
        </For>
      </ScrollView>
    </Sheet>
  );
};
