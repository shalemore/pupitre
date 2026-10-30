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
import { Badge, Button, IconButton, Input, ToggleIconButton } from "@/components/ui";
import { t } from "@/i18n";
import { css, cx } from "@/styled-system/css";
import type { MatchStats, SearchOptions } from "./editor-search";

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
  <ToggleIconButton
    pressed={props.pressed}
    onChange={props.onChange}
    label={props.title}
    size="icon-2xs"
    class={pressedToggle}
  >
    {props.children}
  </ToggleIconButton>
);

const pressedToggle = css({ "&[data-pressed]": { backgroundColor: "brand/15" } });
const bar = css({
  position: "absolute",
  top: "3",
  insetInlineEnd: "5",
  zIndex: "40",
  display: "flex",
  flexDirection: "column",
  gap: "2",
  borderRadius: "xl",
  backgroundColor: "popover/95",
  padding: "2",
  boxShadow: "float",
  backdropFilter: "blur(12px)",
  textStyle: "xs",
  userSelect: "none",
  animationName: "fadeInDown",
  animationDuration: "base",
  animationTimingFunction: "enter",
  maxWidth: "sm",
  width: "full",
  _print: { display: "none" },
});
const row = css({ display: "flex", alignItems: "center", gap: "1.5" });
const chevron = css({
  transitionProperty: "transform",
  transitionDuration: "snap",
  transitionTimingFunction: "snap",
  _rtl: { scale: "-1 1" },
});
const chevronOpen = css({ transform: "rotate(90deg)" });
const searchBox = css({
  position: "relative",
  flex: "1",
  display: "flex",
  alignItems: "center",
  minWidth: 0,
});
const searchField = css({ paddingInlineEnd: "18" });
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
  alignItems: "center",
  gap: "1.5",
  paddingInlineStart: "7",
  animationName: "fadeInDownSmall",
  animationDuration: "base",
  animationTimingFunction: "enter",
});
const grow = css({ flex: "1" });

export const FindBar: Component<FindBarProps> = (props) => {
  const [searchText, setSearchText] = createSignal(props.initialSearch);
  const [replaceText, setReplaceText] = createSignal("");
  const [caseSensitive, setCaseSensitive] = createSignal(false);
  const [wholeWord, setWholeWord] = createSignal(false);
  const [regexp, setRegexp] = createSignal(false);
  const hasMatches = () => props.matchStats.pending === true || props.matchStats.total > 0;
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
    <div data-slot="find-bar" class={cx(bar, props.class)}>
      <div class={row}>
        <IconButton label={t().editor.toggleReplace} onClick={props.onToggleReplace}>
          <ChevronRight class={cx(chevron, props.showReplace && chevronOpen)} />
        </IconButton>

        <div class={searchBox}>
          <Input
            ref={(element) => (searchInput = element)}
            size="sm"
            dir="auto"
            value={searchText()}
            onInput={(e) => setSearchText(e.currentTarget.value)}
            onKeyDown={(e) => handleKeyDown(e, props.onFindNext, props.onFindPrevious)}
            placeholder={t().editor.findPlaceholder}
            class={searchField}
          />

          <div class={options}>
            <FindToggle
              pressed={caseSensitive()}
              onChange={setCaseSensitive}
              title={t().editor.matchCase}
            >
              <CaseSensitive />
            </FindToggle>
            <FindToggle pressed={wholeWord()} onChange={setWholeWord} title={t().editor.wholeWord}>
              <WholeWord />
            </FindToggle>
            <FindToggle pressed={regexp()} onChange={setRegexp} title={t().editor.useRegex}>
              <Regex />
            </FindToggle>
          </div>
        </div>

        <div class={count}>
          <Show when={searchText()}>
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
            value={replaceText()}
            onInput={(e) => setReplaceText(e.currentTarget.value)}
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
