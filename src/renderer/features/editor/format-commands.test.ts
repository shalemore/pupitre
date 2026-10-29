import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { FormatAction } from "@shared/format";
import { DEFAULT_SETTINGS } from "@shared/settings";
import { insertParagraphBreak, type MarkdownStyle, runFormatAction } from "./format-commands";
import { fullTree, marked, markdownView } from "./testing";

const style: MarkdownStyle = DEFAULT_SETTINGS;

/** Runs `action` on `text`, written the way markdownView reads it, and gives the result back that way. */
function format(text: string, action: FormatAction, markdownStyle = style): string {
  const view = markdownView(text);
  runFormatAction(view, action, markdownStyle);
  const result = marked(view);
  view.destroy();
  return result;
}

describe("inline formats", () => {
  it("wraps the selection and keeps it selected", () => {
    expect(format("a |word| here", "bold")).toBe("a **|word|** here");
    expect(format("a |word| here", "italic")).toBe("a *|word|* here");
    expect(format("a |word| here", "strikethrough")).toBe("a ~~|word|~~ here");
    expect(format("a |word| here", "inlineCode")).toBe("a `|word|` here");
  });

  it("writes the markers the style settings ask for", () => {
    const underscores = { ...style, strongMarker: "_", emphasisMarker: "_" } as const;
    expect(format("|word|", "bold", underscores)).toBe("__|word|__");
    expect(format("|word|", "italic", underscores)).toBe("_|word|_");
  });

  it("removes the format the selection is already in", () => {
    expect(format("a **|word|** here", "bold")).toBe("a |word| here");
    expect(format("a *wo|rd* here", "italic")).toBe("a wo|rd here");
  });

  it("keeps the heading markers out of a format that takes in the whole heading", () => {
    expect(format("|# Heading|", "bold")).toBe("# **|Heading|**");
    expect(format("|## Heading|", "italic")).toBe("## *|Heading|*");
    expect(format("|# **Heading**|", "bold")).toBe("|# Heading|");
    // A selection that takes in only part of the heading is wrapped as it is
    expect(format("# H|eading|", "bold")).toBe("# H**|eading|**");
    expect(format("#| Heading|", "bold")).toBe("#**| Heading|**");
  });

  it("gives back the text it started from when applied twice", () => {
    const word = fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,10}[A-Za-z]$/);
    const inline = fc.constantFrom<FormatAction>("bold", "italic", "strikethrough", "inlineCode");
    fc.assert(
      fc.property(word, inline, (text, action) => {
        const view = markdownView(`Before |${text}| after`);
        runFormatAction(view, action, style);
        fullTree(view.state);
        runFormatAction(view, action, style);
        expect(marked(view)).toBe(`Before |${text}| after`);
        view.destroy();
      }),
    );
  });

  it("turns the selection into link text and leaves the cursor where the address goes", () => {
    expect(format("see |the docs|", "link")).toBe("see [the docs](|)");
    expect(format("see [docs](https://exa|mple.com)", "link")).toBe(
      "see [docs](|https://example.com|)",
    );
  });

  it("takes an empty format away on the next press instead of nesting another", () => {
    for (const action of [
      "bold",
      "italic",
      "strikethrough",
      "highlight",
      "subscript",
      "superscript",
      "inlineCode",
      "inlineMath",
      "underline",
      "link",
    ] as const) {
      expect(format(format("a |b", action), action)).toBe("a |b");
    }
  });
});

describe("the inline formats the live preview renders", () => {
  it("wraps and unwraps highlight, subscript, superscript and inline math", () => {
    expect(format("a |word| here", "highlight")).toBe("a ==|word|== here");
    expect(format("a ==|word|== here", "highlight")).toBe("a |word| here");
    expect(format("a |word| here", "subscript")).toBe("a ~|word|~ here");
    expect(format("a |word| here", "superscript")).toBe("a ^|word|^ here");
    expect(format("a |word| here", "inlineMath")).toBe("a $|word|$ here");
  });

  it("wraps and unwraps underline as its HTML tag", () => {
    expect(format("a |word| here", "underline")).toBe("a <u>|word|</u> here");
    expect(format("a <u>|word|</u> here", "underline")).toBe("a |word| here");
  });

  it("clears the inline formats a selection covers and turns a link into its text", () => {
    expect(format("|**word**|", "clearFormat")).toBe("|word|");
    expect(format("**wo|rd**", "clearFormat")).toBe("wo|rd");
    expect(format("|[text](url)|", "clearFormat")).toBe("|text|");
  });
});

describe("the block actions", () => {
  it("inserts a table of contents and a footnote reference with its definition", () => {
    expect(format("|", "toc")).toBe("[TOC]\n|");
    expect(format("one|", "footnote")).toBe("one[^1]|\n\n[^1]: ");
    expect(format("one[^1] and |\n\n[^1]: first\n", "footnote")).toBe(
      "one[^1] and [^2]|\n\n[^1]: first\n\n[^2]: \n",
    );
  });

  it("steps a heading up and down, and a paragraph becomes a heading", () => {
    expect(format("## Ti|tle", "headingUp")).toBe("# Ti|tle");
    expect(format("# Ti|tle", "headingUp")).toBe("Ti|tle");
    expect(format("Ti|tle", "headingUp")).toBe("# Ti|tle");
    expect(format("## Ti|tle", "headingDown")).toBe("### Ti|tle");
    expect(format("###### Ti|tle", "headingDown")).toBe("Ti|tle");
  });
});

describe("block formats", () => {
  it("sets, changes and removes a heading level", () => {
    expect(format("Ti|tle", "heading2")).toBe("## Ti|tle");
    expect(format("## Ti|tle", "heading3")).toBe("### Ti|tle");
    expect(format("## Ti|tle", "heading2")).toBe("Ti|tle");
    expect(format("### Ti|tle", "paragraph")).toBe("Ti|tle");
  });

  it("puts a heading after the quote or list marker of its line", () => {
    expect(format("> Ti|tle", "heading1")).toBe("> # Ti|tle");
    expect(format("- Ti|tle", "heading1")).toBe("- # Ti|tle");
  });

  it("quotes every selected line and unquotes a quote", () => {
    expect(format("|one\ntwo|", "quote")).toBe("> |one\n> two|");
    expect(format("> |one\n> two|", "quote")).toBe("|one\ntwo|");
  });

  it("numbers the items of an ordered list as the style asks", () => {
    expect(format("|one\ntwo\nthree|", "orderedList")).toBe("1. |one\n2. two\n3. three|");
    const flat = { ...style, incrementListMarker: false };
    expect(format("|one\ntwo|", "orderedList", flat)).toBe("1. |one\n1. two|");
  });

  it("switches a list between bullets and numbers, and removes it", () => {
    expect(format("|one\ntwo|", "bulletList")).toBe("- |one\n- two|");
    expect(format("- |one\n- two|", "orderedList")).toBe("1. |one\n2. two|");
    expect(format("- |one\n- two|", "bulletList")).toBe("|one\ntwo|");
  });

  it("opens an empty fenced block with the cursor inside", () => {
    expect(format("|", "codeBlock")).toBe("```\n|\n```");
    expect(format("|", "mathBlock")).toBe("$$\n|\n$$");
  });

  it("wraps the selected lines in a fence", () => {
    expect(format("|let a = 1|", "codeBlock")).toBe("```\n|let a = 1|\n```");
  });

  it("inserts a table and a divider as blocks of their own", () => {
    expect(format("Text|", "divider")).toBe("Text\n\n---\n|");
    expect(format("|", "table")).toBe("| | |  |  |\n| --- | --- | --- |\n|  |  |  |\n");
  });
});

describe("insertParagraphBreak", () => {
  function enter(text: string): string {
    const view = markdownView(text);
    insertParagraphBreak(view);
    const result = marked(view);
    view.destroy();
    return result;
  }

  it("starts a new paragraph after a blank line", () => {
    expect(enter("One sentence.| Another one.")).toBe("One sentence.\n\n|Another one.");
  });

  it("leaves lists and quotes to the list continuation", () => {
    expect(enter("- item|")).toBe("- item|");
    expect(enter("> quote|")).toBe("> quote|");
  });
});

describe("fenced blocks", () => {
  it("opens an empty block and takes it away on the next press", () => {
    expect(format("|", "codeBlock")).toBe("```\n|\n```");
    expect(format("```\n|\n```", "codeBlock")).toBe("|");
    expect(format("|", "mathBlock")).toBe("$$\n|\n$$");
    expect(format("$$\n|\n$$", "mathBlock")).toBe("|");
  });

  it("takes the fences off a block that has content", () => {
    expect(format("```\nco|de\n```", "codeBlock")).toBe("co|de");
  });
});
