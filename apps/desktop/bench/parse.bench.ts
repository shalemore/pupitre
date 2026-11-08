import { DocInput } from "@codemirror/language";
import { ChangeSet, Text } from "@codemirror/state";
import { TreeFragment } from "@lezer/common";
import type { ChangedRange, Tree } from "@lezer/common";
import { describe, expect, test } from "vitest";
import { markdownLanguage } from "@/lib/markdown/language";

/**
 * The cost of reading a document, measured on the language the editor parses with, so a change to
 * a Markdown extension shows up here as well as in its tests. The documents are Text ropes, as the
 * editor hands them over, and the incremental case reuses the tree the way the editor's parse
 * context does. Absolute numbers depend on the machine; compare runs of the same machine.
 */

const parser = markdownLanguage.language.parser;

/** About a megabyte, which is where a long note starts to feel slow. */
const DOCUMENT_SIZE = 1024 * 1024;

/** What a long article holds: headings, lists, quotes, code, links, math and the inline markers. */
const PROSE_BLOCKS: readonly string[] = [
  "## Keeping the source\n\nThe document on disk is the Markdown the editor shows: every marker is a real character, so copying a paragraph copies **bold** and `code` with it, and saving writes back exactly what was typed.\n\n",
  "- The outline follows the headings the parser found\n- The word count follows the text, not the markers\n- The find bar searches the file as it is\n\n",
  "> A blockquote holds a paragraph of its own and wraps the way the window does, which keeps the measured line box the same however long the sentence gets.\n\n",
  "```ts\nconst tree = parser.parse(document, fragments);\nconst gaps = TreeFragment.applyChanges(fragments, change);\n```\n\n",
  "A [link to the project](https://github.com/shalemore/pupitre) and an ![image](logo.svg) read as text until the pointer is over them, so the line never shifts under the caret.\n\n",
  "Inline math such as $e^{i\\pi} + 1 = 0$ sits in the line, a display block such as $$\\int_0^1 x\\,dx = \\tfrac{1}{2}$$ takes one of its own, and a footnote reference[^note] stays a reference.\n\n[^note]: The definition is parsed by the same extension as the reference, so a moved marker moves both.\n\n",
  "Highlighted ==text==, emoji :tada:, subscript H~2~O and superscript x^2^ are parsed inline, and a paragraph of this length is the common case in a long document.\n\n",
  "### A smaller heading\n\n1. Numbered lists indent their continuation lines\n2. So a wrapped item keeps its marker outside the text\n3. And a nested list under it turns into a deeper item\n\n",
];

/** A table with an alignment row, inline markers and cells that wrap at different widths. */
const TABLES: readonly string[] = [
  "| Setting | Default | Range | Notes |\n| :------ | :-----: | ----: | :---- |\n| Body font size | 16px | 12-32 | Follows the theme until the user picks one |\n| Line height | 1.6 | 1.2-2.0 | In `em`, so a theme can scale it |\n| Content width | 44rem | 30-80 | Wide tables scroll sideways |\n| **Body font** | theme | any | A font that is missing falls back to the theme |\n\n",
];

/** The first block of every generated document, so the front matter is parsed too. */
const FRONT_MATTER = "---\ntitle: A long document\ntags: [bench, parser]\n---\n\n";

/** `blocks` repeated until the text reaches `size`; the documents are ASCII, so a char is a byte. */
function fill(blocks: readonly string[], size: number): string {
  let text = "";
  for (let i = 0; text.length < size; i++) text += blocks[i % blocks.length] ?? "";
  return text;
}

function documentOf(blocks: readonly string[]): Text {
  return Text.of(fill(blocks, DOCUMENT_SIZE).split("\n"));
}

function read(source: Text, previous?: readonly TreeFragment[]): Tree {
  // The editor hands the parser its document through a DocInput, which reads it line by line
  return parser.parse(new DocInput(source), previous);
}

const prose = documentOf([FRONT_MATTER, ...PROSE_BLOCKS]);
const tables = documentOf(TABLES);
const proseTree = read(prose);

/** A typed character in the middle of the prose, as far from the start as from the end. */
const edit = ChangeSet.of({ from: Math.floor(prose.length / 2), insert: "x" }, prose.length);
const edited = edit.apply(prose);
const changed: ChangedRange[] = [];
edit.iterChangedRanges((fromA, toA, fromB, toB) => {
  changed.push({ fromA, toA, fromB, toB });
});
/**
 * The old tree cut around the edit. `applyChanges` leaves a gap of at least 128 characters there,
 * which is what the editor's parse context hands the parser when a key is pressed; everything
 * outside the gap is reused.
 */
const fragments = TreeFragment.applyChanges(TreeFragment.addTree(proseTree), changed);

describe("markdown parser", () => {
  test("full parse of a megabyte of prose", async ({ bench }) => {
    const result = await bench("full parse", () => read(prose)).run();
    expect(result.period).toBeGreaterThan(0);
  });

  test("full parse of a table-heavy document", async ({ bench }) => {
    const result = await bench("full parse", () => read(tables)).run();
    expect(result.period).toBeGreaterThan(0);
  });

  test("reparse after one typed character", async ({ bench }) => {
    const result = await bench("reparse", () => read(edited, fragments)).run();
    expect(result.period).toBeGreaterThan(0);
  });
});
