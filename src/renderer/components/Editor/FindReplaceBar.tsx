import {
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Regex,
  WholeWord,
  X,
} from "lucide-solid";
import { createEffect, createSignal, Show, type Component } from "solid-js";
import { Badge, Button } from "@/components/ui";
import { t } from "@/i18n";

export interface FindReplaceBarProps {
  isOpen: boolean;
  isReplaceOpen: boolean;
  onClose: () => void;
  onToggleReplace: () => void;
  onFindNext: () => void;
  onFindPrev: () => void;
  onReplaceNext: () => void;
  onReplaceAll: () => void;
  onQueryChange: (query: {
    search: string;
    replace: string;
    caseSensitive: boolean;
    wholeWord: boolean;
    regexp: boolean;
  }) => void;
  matchStats: { current: number; total: number };
  initialSearchText?: string;
}

export const FindReplaceBar: Component<FindReplaceBarProps> = (props) => {
  const [searchText, setSearchText] = createSignal("");
  const [replaceText, setReplaceText] = createSignal("");
  const [caseSensitive, setCaseSensitive] = createSignal(false);
  const [wholeWord, setWholeWord] = createSignal(false);
  const [regexp, setRegexp] = createSignal(false);

  let searchInputRef: HTMLInputElement | null = null;
  let replaceInputRef: HTMLInputElement | null = null;

  createEffect(() => {
    if (props.isOpen && props.initialSearchText) {
      setSearchText(props.initialSearchText);
    }
  });

  createEffect(() => {
    props.onQueryChange({
      search: searchText(),
      replace: replaceText(),
      caseSensitive: caseSensitive(),
      wholeWord: wholeWord(),
      regexp: regexp(),
    });
  });

  createEffect(() => {
    if (props.isOpen) {
      setTimeout(() => {
        searchInputRef?.focus();
        searchInputRef?.select();
      }, 50);
    }
  });

  createEffect(() => {
    if (props.isReplaceOpen) {
      setTimeout(() => {
        replaceInputRef?.focus();
        replaceInputRef?.select();
      }, 50);
    }
  });

  const handleSearchKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        props.onFindPrev();
      } else {
        props.onFindNext();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
    }
  };

  const handleReplaceKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        props.onReplaceAll();
      } else {
        props.onReplaceNext();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        data-slot="find-replace-bar"
        class="absolute top-3 right-5 z-40 flex flex-col gap-2 rounded-xl border border-border/80 bg-surface-2/95 p-2 shadow-float backdrop-blur-md text-xs select-none animate-in fade-in-0 slide-in-from-top-2 duration-(--duration-ui) max-w-sm w-full"
      >
        <div class="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={props.onToggleReplace}
            title={t().editor.toggleReplace}
            class="text-muted-foreground hover:text-foreground shrink-0"
          >
            <ChevronRight
              class={`size-3.5 transition-transform duration-(--duration-snap) ${
                props.isReplaceOpen ? "rotate-90" : ""
              }`}
            />
          </Button>

          <div class="relative flex-1 flex items-center min-w-0">
            <input
              ref={(el) => {
                searchInputRef = el;
              }}
              type="text"
              value={searchText()}
              onInput={(e) => setSearchText(e.currentTarget.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Find..."
              class="h-7 w-full rounded-md border border-input bg-surface-0/60 pl-2 pr-16 text-xs transition-colors outline-none focus-visible:shadow-focus placeholder:text-muted-foreground"
            />

            <div class="absolute right-1 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setCaseSensitive(!caseSensitive())}
                title="Match Case (Alt+C)"
                class={`p-0.5 rounded-sm transition-colors cursor-pointer ${
                  caseSensitive()
                    ? "bg-brand/20 text-brand font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <CaseSensitive class="size-3" />
              </button>
              <button
                type="button"
                onClick={() => setWholeWord(!wholeWord())}
                title="Match Whole Word (Alt+W)"
                class={`p-0.5 rounded-sm transition-colors cursor-pointer ${
                  wholeWord()
                    ? "bg-brand/20 text-brand font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <WholeWord class="size-3" />
              </button>
              <button
                type="button"
                onClick={() => setRegexp(!regexp())}
                title="Use Regular Expression (Alt+R)"
                class={`p-0.5 rounded-sm transition-colors cursor-pointer ${
                  regexp()
                    ? "bg-brand/20 text-brand font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Regex class="size-3" />
              </button>
            </div>
          </div>

          <div class="shrink-0 text-[11px] tabular-nums">
            <Show
              when={searchText().length > 0}
              fallback={<span class="text-muted-foreground text-[10px]">0</span>}
            >
              <Show
                when={props.matchStats.total > 0}
                fallback={
                  <Badge variant="destructive" size="sm">
                    0
                  </Badge>
                }
              >
                <Badge variant="secondary" size="sm">
                  {props.matchStats.current}/{props.matchStats.total}
                </Badge>
              </Show>
            </Show>
          </div>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={props.onFindPrev}
            title="Previous match (Shift+Enter)"
            disabled={props.matchStats.total === 0}
            class="shrink-0"
          >
            <ChevronUp class="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={props.onFindNext}
            title="Next match (Enter)"
            disabled={props.matchStats.total === 0}
            class="shrink-0"
          >
            <ChevronDown class="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={props.onClose}
            title="Close (Escape)"
            class="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X class="size-3.5" />
          </Button>
        </div>

        <Show when={props.isReplaceOpen}>
          <div class="flex items-center gap-1.5 pl-6 pt-0.5 animate-in fade-in-0 slide-in-from-top-1 duration-(--duration-snap)">
            <input
              ref={(el) => {
                replaceInputRef = el;
              }}
              type="text"
              value={replaceText()}
              onInput={(e) => setReplaceText(e.currentTarget.value)}
              onKeyDown={handleReplaceKeyDown}
              placeholder="Replace with..."
              class="h-7 flex-1 rounded-md border border-input bg-surface-0/60 px-2 text-xs transition-colors outline-none focus-visible:shadow-focus placeholder:text-muted-foreground"
            />

            <Button
              variant="outline"
              size="xs"
              onClick={props.onReplaceNext}
              disabled={props.matchStats.total === 0}
            >
              Replace
            </Button>

            <Button
              variant="outline"
              size="xs"
              onClick={props.onReplaceAll}
              disabled={props.matchStats.total === 0}
            >
              All
            </Button>
          </div>
        </Show>
      </div>
    </Show>
  );
};
