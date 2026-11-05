import { createMemo, type Component, Show } from "solid-js";
import { t } from "@/i18n";
import type { TextStats } from "@/lib/text-stats";
import { css } from "@/styled-system/css";

const label = css({
  textStyle: "2xs",
  color: "muted.foreground",
  fontVariantNumeric: "tabular-nums",
  display: "flex",
  flexShrink: 0,
  alignItems: "center",
  gap: "1.5",
  whiteSpace: "nowrap",
  marginInlineEnd: "2",
});

// A page written mostly in Han or kana counts its characters one by one, the way Word counts
// Chinese; a page of words counts the words between spaces
const countKind = (stats: TextStats): "word" | "character" =>
  stats.cjk * 2 >= stats.words ? "character" : "word";

/** The words and characters of the document, and of the selection when there is one. */
export const WordCount: Component<{ stats: TextStats }> = (props) => {
  const wordsText = createMemo(() => {
    const { words, selectedWords } = props.stats;
    const total = t().common.wordsCount(words, countKind(props.stats));
    return selectedWords === undefined
      ? total
      : t().common.selectedOfTotal(
          t().common.wordsCount(selectedWords, countKind(props.stats)),
          total,
        );
  });
  const charsText = createMemo(() => {
    const { characters, selectedCharacters } = props.stats;
    const total = t().common.charsCount(characters);
    return selectedCharacters === undefined
      ? total
      : t().common.selectedOfTotal(t().common.charsCount(selectedCharacters), total);
  });

  // The character count is a second reading of a dense page; a page of words needs only the words
  // beside them, and shows both counts when pointed at
  return (
    <div data-bar-part="count" title={`${wordsText()} · ${charsText()}`} class={label}>
      <span>{wordsText()}</span>
      <Show when={countKind(props.stats) === "character"}>
        <span>·</span>
        <span>{charsText()}</span>
      </Show>
    </div>
  );
};
