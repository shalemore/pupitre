import { t } from "@pupitre/i18n/solid";
import { Badge, Button, cn, IconButton, Input } from "@pupitre/ui";
import { ChevronDown, ChevronRight, ChevronUp, X } from "lucide-solid";
import { createEffect, Show, type Component } from "solid-js";
import { SearchOptionToggles } from "@/components/search-option-toggles";
import type { MatchStats, SearchOptions } from "./search";

export interface FindBarProps {
  showReplace: boolean;
  options: SearchOptions;
  matchStats: MatchStats;
  onToggleReplace: () => void;
  onClose: () => void;
  onOptionsChange: (options: SearchOptions) => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  onReplaceNext: () => void;
  onReplaceAll: () => void;
  class?: string;
}

export const FindBar: Component<FindBarProps> = (props) => {
  const hasMatches = () => props.matchStats.pending === true || props.matchStats.total > 0;
  let searchInput: HTMLInputElement | undefined;
  let replaceInput: HTMLInputElement | undefined;

  const update = (patch: Partial<SearchOptions>) =>
    props.onOptionsChange({ ...props.options, ...patch });

  // Each time the bar is reopened (or switched to replace), focus the matching input and select its text
  createEffect(
    () => props.showReplace,
    (showReplace) => {
      const input = showReplace ? replaceInput : searchInput;
      input?.focus();
      input?.select();
    },
  );

  const handleKeyDown = (e: KeyboardEvent, onEnter: () => void, onShiftEnter: () => void) => {
    // Enter while composing with an input method confirms the candidate and must not trigger a search
    if (e.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (!hasMatches()) return;
      (e.shiftKey ? onShiftEnter : onEnter)();
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
    }
  };

  const matchLabel = () => {
    if (props.matchStats.pending) return "…";
    const { current, total, capped } = props.matchStats;
    if (capped && current === 0) return `${total}+`;
    return `${current}/${total}${capped ? "+" : ""}`;
  };

  return (
    <div
      data-slot="find-bar"
      class={cn(
        "__FLOATING_PANEL__ absolute inset-x-5 top-3 z-40 flex max-w-sm animate-fade-in-down flex-col gap-2 p-2 text-xs select-none print:hidden",
        props.class,
      )}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        props.onClose();
      }}
    >
      <div class="flex flex-wrap items-center gap-1.5">
        <IconButton label={t().editor.toggleReplace} onClick={props.onToggleReplace}>
          <ChevronRight
            class={cn(
              "transition-transform duration-snap ease-snap rtl:-scale-x-100",
              props.showReplace && "rotate-90",
            )}
          />
        </IconButton>

        <div class="relative flex min-w-32 flex-1 items-center">
          <Input
            ref={(element) => (searchInput = element)}
            size="sm"
            dir="auto"
            value={props.options.search}
            onInput={(e) => update({ search: e.currentTarget.value })}
            onKeyDown={(e) => handleKeyDown(e, props.onFindNext, props.onFindPrevious)}
            placeholder={t().editor.findPlaceholder}
            class="pe-[4.5rem]"
          />

          <SearchOptionToggles
            class="absolute inset-e-1"
            caseSensitive={props.options.caseSensitive}
            wholeWord={props.options.wholeWord}
            regexp={props.options.regexp}
            onCaseSensitiveChange={(value) => update({ caseSensitive: value })}
            onWholeWordChange={(value) => update({ wholeWord: value })}
            onRegexpChange={(value) => update({ regexp: value })}
          />
        </div>

        <div class="shrink-0 tabular-nums">
          <Show when={props.options.search}>
            <Badge variant={hasMatches() ? "secondary" : "destructive"} size="sm" dir="ltr">
              {matchLabel()}
            </Badge>
          </Show>
        </div>

        <IconButton
          label={t().editor.previousMatch}
          onClick={props.onFindPrevious}
          disabled={!hasMatches()}
        >
          <ChevronUp />
        </IconButton>
        <IconButton
          label={t().editor.nextMatch}
          onClick={props.onFindNext}
          disabled={!hasMatches()}
        >
          <ChevronDown />
        </IconButton>
        <IconButton label={t().editor.closeFind} onClick={props.onClose}>
          <X />
        </IconButton>
      </div>

      <Show when={props.showReplace}>
        <div class="flex animate-fade-in-down-small flex-wrap items-center gap-1.5 ps-7">
          <Input
            ref={(element) => (replaceInput = element)}
            size="sm"
            dir="auto"
            value={props.options.replace}
            onInput={(e) => update({ replace: e.currentTarget.value })}
            onKeyDown={(e) => handleKeyDown(e, props.onReplaceNext, props.onReplaceAll)}
            placeholder={t().editor.replacePlaceholder}
            class="min-w-28 flex-1"
          />
          <Button
            variant="outline"
            size="xs"
            onClick={props.onReplaceNext}
            disabled={!hasMatches()}
          >
            {t().editor.replaceOne}
          </Button>
          <Button variant="outline" size="xs" onClick={props.onReplaceAll} disabled={!hasMatches()}>
            {t().editor.replaceAll}
          </Button>
        </div>
      </Show>
    </div>
  );
};
