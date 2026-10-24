import type { MarkdownConfig } from "@lezer/markdown";

const EQUALS = 61;
const delimiter = { resolve: "Highlight", mark: "HighlightMark" };

/**
 * `==highlighted==` text, as in Typora and Obsidian. The delimiters follow the rule of `~~`: an
 * opening one is not followed by a space and a closing one does not follow a space.
 */
export const highlight: MarkdownConfig = {
  defineNodes: ["Highlight", "HighlightMark"],
  parseInline: [
    {
      name: "Highlight",
      after: "Emphasis",
      parse(cx, next, pos) {
        if (next !== EQUALS || cx.char(pos + 1) !== EQUALS) return -1;
        if (cx.char(pos - 1) === EQUALS || cx.char(pos + 2) === EQUALS) return -1;
        const spaceBefore = /\s|^$/.test(cx.slice(pos - 1, pos));
        const spaceAfter = /\s|^$/.test(cx.slice(pos + 2, pos + 3));
        return cx.addDelimiter(delimiter, pos, pos + 2, !spaceAfter, !spaceBefore);
      },
    },
  ],
};
