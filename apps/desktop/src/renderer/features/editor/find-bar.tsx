import { t } from "@pupitre/i18n/solid";
import { Badge, Button, IconButton, Input, ToggleIconButton } from "@pupitre/ui";
import type { JSX } from "@solidjs/web";
import {
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Regex,
  WholeWord,
  X,
} from "lucide-solid";
import { createEffect, Show, type Component } from "solid-js";
import { css, cx } from "@/styled-system/css";
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

const FindToggle: Component<{
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  title: string;
  children: JSX.Element;
}> = (props) => (
  // A press on the toggle must not take the focus from the query, or the next typed key goes to the button
  <span class={toggleWrap} onMouseDown={(event) => event.preventDefault()}>
    <ToggleIconButton
      pressed={props.pressed}
      onChange={props.onChange}
      label={props.title}
      size="icon-2xs"
      class={pressedToggle}
    >
      {props.children}
    </ToggleIconButton>
  </span>
);

const pressedToggle = css({ "&[data-pressed]": { backgroundColor: "brand/15" } });
const toggleWrap = css({ display: "flex" });
const bar = css({
  position: "absolute",
  top: "3",
  insetInline: "5",
  zIndex: "40",
  display: "flex",
  flexDirection: "column",
  gap: "2",
  borderRadius: "xl",
  backgroundColor: "popover/95",
  padding: "2",
  boxShadow: "float",
  backdropFilter: "[blur(12px)]",
  textStyle: "xs",
  userSelect: "none",
  animationName: "fadeInDown",
  animationDuration: "base",
  animationTimingFunction: "enter",
  maxWidth: "sm",
  _print: { display: "none" },
});
const row = css({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1.5" });
const chevron = css({
  transitionProperty: "transform",
  transitionDuration: "snap",
  transitionTimingFunction: "snap",
  _rtl: { scale: "[-1 1]" },
});
const chevronOpen = css({ transform: "rotate(90deg)" });
const searchBox = css({
  position: "relative",
  flex: "1",
  display: "flex",
  alignItems: "center",
  minWidth: "32",
});
const searchField = css({ paddingInlineEnd: "[4.5rem]" });
const options = css({
  position: "absolute",
  insetInlineEnd: "1",
  display: "flex",
  alignItems: "center",
  gap: "0.5",
});
const count = css({ flexShrink: 0, fontVariantNumeric: "tabular-nums" });
const replaceRow = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "1.5",
  paddingInlineStart: "7",
  animationName: "fadeInDownSmall",
  animationDuration: "base",
  animationTimingFunction: "enter",
});
const grow = css({ flex: "1", minWidth: "28" });

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
      class={cx(bar, props.class)}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        props.onClose();
      }}
    >
      <div class={row}>
        <IconButton label={t().editor.toggleReplace} onClick={props.onToggleReplace}>
          <ChevronRight class={cx(chevron, props.showReplace && chevronOpen)} />
        </IconButton>

        <div class={searchBox}>
          <Input
            ref={(element) => (searchInput = element)}
            size="sm"
            dir="auto"
            value={props.options.search}
            onInput={(e) => update({ search: e.currentTarget.value })}
            onKeyDown={(e) => handleKeyDown(e, props.onFindNext, props.onFindPrevious)}
            placeholder={t().editor.findPlaceholder}
            class={searchField}
          />

          <div class={options}>
            <FindToggle
              pressed={props.options.caseSensitive}
              onChange={(value) => update({ caseSensitive: value })}
              title={t().editor.matchCase}
            >
              <CaseSensitive />
            </FindToggle>
            <FindToggle
              pressed={props.options.wholeWord}
              onChange={(value) => update({ wholeWord: value })}
              title={t().editor.wholeWord}
            >
              <WholeWord />
            </FindToggle>
            <FindToggle
              pressed={props.options.regexp}
              onChange={(value) => update({ regexp: value })}
              title={t().editor.useRegex}
            >
              <Regex />
            </FindToggle>
          </div>
        </div>

        <div class={count}>
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
        <div class={replaceRow}>
          <Input
            ref={(element) => (replaceInput = element)}
            size="sm"
            dir="auto"
            value={props.options.replace}
            onInput={(e) => update({ replace: e.currentTarget.value })}
            onKeyDown={(e) => handleKeyDown(e, props.onReplaceNext, props.onReplaceAll)}
            placeholder={t().editor.replacePlaceholder}
            class={grow}
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
