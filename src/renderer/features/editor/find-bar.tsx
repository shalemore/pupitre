import { ToggleButton } from "@kobalte/core/toggle-button";
import { cn } from "cn";
import {
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Regex,
  WholeWord,
  X,
} from "lucide-solid";
import { createEffect, createSignal, on, Show, type Component, type JSX } from "solid-js";
import { Badge, Button } from "@/components/ui";
import { t } from "@/i18n";
import type { MatchStats, SearchOptions } from "./markdown-editor";

export interface FindBarProps {
  showReplace: boolean;
  /** Search text prefilled on open, usually the text selected in the editor. */
  initialSearch: string;
  matchStats: MatchStats;
  onToggleReplace: () => void;
  onClose: () => void;
  onSearchChange: (options: SearchOptions) => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  onReplaceNext: () => void;
  onReplaceAll: () => void;
  class?: string;
}

const FindToggle: Component<{
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  title: string;
  children: JSX.Element;
}> = (props) => (
  <ToggleButton
    pressed={props.pressed}
    onChange={props.onChange}
    title={props.title}
    aria-label={props.title}
    class="p-0.5 rounded-sm transition-colors cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted data-pressed:bg-brand/20 data-pressed:text-brand"
  >
    {props.children}
  </ToggleButton>
);

export const FindBar: Component<FindBarProps> = (props) => {
  const [searchText, setSearchText] = createSignal(props.initialSearch);
  const [replaceText, setReplaceText] = createSignal("");
  const [caseSensitive, setCaseSensitive] = createSignal(false);
  const [wholeWord, setWholeWord] = createSignal(false);
  const [regexp, setRegexp] = createSignal(false);
  let searchInput: HTMLInputElement | undefined;
  let replaceInput: HTMLInputElement | undefined;

  createEffect(() => {
    props.onSearchChange({
      search: searchText(),
      replace: replaceText(),
      caseSensitive: caseSensitive(),
      wholeWord: wholeWord(),
      regexp: regexp(),
    });
  });

  // Each time the bar is reopened (or switched to replace), focus the matching input and select its text
  createEffect(
    on(
      () => props.showReplace,
      (showReplace) => {
        const input = showReplace ? replaceInput : searchInput;
        input?.focus();
        input?.select();
      },
    ),
  );

  createEffect(
    on(
      () => props.initialSearch,
      (text) => {
        if (text) setSearchText(text);
        searchInput?.select();
      },
    ),
  );

  const handleKeyDown = (e: KeyboardEvent, onEnter: () => void, onShiftEnter: () => void) => {
    // Enter while composing with an input method confirms the candidate and must not trigger a search
    if (e.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      (e.shiftKey ? onShiftEnter : onEnter)();
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
    }
  };

  return (
    <div
      data-slot="find-bar"
      class={cn(
        "absolute top-3 inset-e-5 z-40 flex flex-col gap-2 rounded-xl border border-border/80 bg-surface-2/95 p-2 shadow-float backdrop-blur-md text-xs select-none animate-in fade-in-0 slide-in-from-top-2 duration-(--duration-ui) max-w-sm w-full print:hidden",
        props.class,
      )}
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
            class={cn(
              "size-3.5 transition-transform duration-(--duration-snap) rtl:-scale-x-100",
              props.showReplace && "rotate-90",
            )}
          />
        </Button>

        <div class="relative flex-1 flex items-center min-w-0">
          <input
            ref={(element) => (searchInput = element)}
            type="text"
            dir="auto"
            value={searchText()}
            onInput={(e) => setSearchText(e.currentTarget.value)}
            onKeyDown={(e) => handleKeyDown(e, props.onFindNext, props.onFindPrevious)}
            placeholder={t().editor.findPlaceholder}
            class="h-7 w-full rounded-md border border-input bg-surface-0/60 ps-2 pe-16 text-xs transition-colors outline-none focus-visible:shadow-focus placeholder:text-muted-foreground"
          />

          <div class="absolute inset-e-1 flex items-center gap-0.5">
            <FindToggle
              pressed={caseSensitive()}
              onChange={setCaseSensitive}
              title={t().editor.matchCase}
            >
              <CaseSensitive class="size-3" />
            </FindToggle>
            <FindToggle pressed={wholeWord()} onChange={setWholeWord} title={t().editor.wholeWord}>
              <WholeWord class="size-3" />
            </FindToggle>
            <FindToggle pressed={regexp()} onChange={setRegexp} title={t().editor.useRegex}>
              <Regex class="size-3" />
            </FindToggle>
          </div>
        </div>

        <div class="shrink-0 text-[11px] tabular-nums">
          <Show when={searchText()}>
            <Badge variant={props.matchStats.total > 0 ? "secondary" : "destructive"} size="sm">
              {props.matchStats.current}/{props.matchStats.total}
            </Badge>
          </Show>
        </div>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={props.onFindPrevious}
          title={t().editor.previousMatch}
          disabled={props.matchStats.total === 0}
          class="shrink-0"
        >
          <ChevronUp class="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={props.onFindNext}
          title={t().editor.nextMatch}
          disabled={props.matchStats.total === 0}
          class="shrink-0"
        >
          <ChevronDown class="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={props.onClose}
          title={t().editor.closeFind}
          class="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X class="size-3.5" />
        </Button>
      </div>

      <Show when={props.showReplace}>
        <div class="flex items-center gap-1.5 ps-7 animate-in fade-in-0 slide-in-from-top-1 duration-(--duration-snap)">
          <input
            ref={(element) => (replaceInput = element)}
            type="text"
            dir="auto"
            value={replaceText()}
            onInput={(e) => setReplaceText(e.currentTarget.value)}
            onKeyDown={(e) => handleKeyDown(e, props.onReplaceNext, props.onReplaceAll)}
            placeholder={t().editor.replacePlaceholder}
            class="h-7 flex-1 min-w-0 rounded-md border border-input bg-surface-0/60 px-2 text-xs transition-colors outline-none focus-visible:shadow-focus placeholder:text-muted-foreground"
          />
          <Button
            variant="outline"
            size="xs"
            onClick={props.onReplaceNext}
            disabled={props.matchStats.total === 0}
          >
            {t().editor.replaceOne}
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={props.onReplaceAll}
            disabled={props.matchStats.total === 0}
          >
            {t().editor.replaceAll}
          </Button>
        </div>
      </Show>
    </div>
  );
};
