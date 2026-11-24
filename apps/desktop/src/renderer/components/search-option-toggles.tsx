import { t } from "@pupitre/i18n/solid";
import { cn, ToggleIconButton } from "@pupitre/ui";
import type { JSX } from "@solidjs/web";
import { CaseSensitive, Regex, WholeWord } from "lucide-solid";
import type { Component } from "solid-js";

export interface SearchOptionTogglesProps {
  caseSensitive: boolean;
  wholeWord: boolean;
  regexp: boolean;
  onCaseSensitiveChange: (pressed: boolean) => void;
  onWholeWordChange: (pressed: boolean) => void;
  onRegexpChange: (pressed: boolean) => void;
  size?: "icon-2xs" | "icon-xs";
  class?: string;
}

const OptionToggle: Component<{
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  label: string;
  size: "icon-2xs" | "icon-xs";
  children: JSX.Element;
}> = (props) => (
  // A press on the toggle must not steal focus from the search query input
  <span class="flex" onMouseDown={(event) => event.preventDefault()}>
    <ToggleIconButton
      pressed={props.pressed}
      onChange={props.onChange}
      label={props.label}
      size={props.size}
      class="text-muted-foreground data-pressed:bg-brand/15"
    >
      {props.children}
    </ToggleIconButton>
  </span>
);

/** Shared case-sensitive, whole-word, and regex toggle buttons for document and workspace search. */
export const SearchOptionToggles: Component<SearchOptionTogglesProps> = (props) => {
  const size = () => props.size ?? "icon-2xs";
  return (
    <div class={cn("flex shrink-0 items-center gap-0.5", props.class)}>
      <OptionToggle
        pressed={props.caseSensitive}
        onChange={props.onCaseSensitiveChange}
        label={t().editor.matchCase}
        size={size()}
      >
        <CaseSensitive />
      </OptionToggle>
      <OptionToggle
        pressed={props.wholeWord}
        onChange={props.onWholeWordChange}
        label={t().editor.wholeWord}
        size={size()}
      >
        <WholeWord />
      </OptionToggle>
      <OptionToggle
        pressed={props.regexp}
        onChange={props.onRegexpChange}
        label={t().editor.useRegex}
        size={size()}
      >
        <Regex />
      </OptionToggle>
    </div>
  );
};
