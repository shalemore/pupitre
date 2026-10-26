import { tests as specExamples } from "commonmark-spec";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { collectHeadings, readableText } from "./document-structure";
import { fullTree, markdownState, treeShape, updated } from "./testing";

/** The names of the nodes the parser reads `doc` into, in document order. */
function nodeNames(doc: string): string[] {
  return treeShape(markdownState(doc)).map((node) => node.split(" ")[0] ?? "");
}

describe("the CommonMark examples", () => {
  it.each(specExamples.map((example) => [example.number, example.section, example.markdown]))(
    "example %i (%s) reads as one tree over the whole text",
    (_number, _section, markdown) => {
      const state = markdownState(markdown);
      const tree = fullTree(state);
      expect(tree.type.name).toBe("Document");
      expect(tree.length).toBe(markdown.length);
      const misplaced: string[] = [];
      tree.iterate({
        enter: (node) => {
          const parent = node.node.parent ?? node;
          if (node.from > node.to || node.from < parent.from || node.to > parent.to) {
            misplaced.push(`${node.name} ${node.from}-${node.to}`);
          }
        },
      });
      expect(misplaced).toEqual([]);
      expect(() => readableText(state)).not.toThrow();
      expect(() => collectHeadings(state)).not.toThrow();
    },
  );
});

describe("the syntax Pupitre adds", () => {
  it("reads inline and block math, and leaves prices as text", () => {
    expect(nodeNames("An $x^2$ formula")).toContain("InlineMath");
    expect(nodeNames("$$\nx^2\n$$")).toContain("BlockMath");
    expect(nodeNames("It costs $5 and $10.")).not.toContain("InlineMath");
  });

  it("reads highlights, but not across a space", () => {
    expect(nodeNames("Some ==marked== text")).toContain("Highlight");
    expect(nodeNames("Some == spaced== text")).not.toContain("Highlight");
  });

  it("reads front matter only at the start of the file", () => {
    expect(nodeNames("---\ntitle: Notes\n---\n\n# Notes")).toContain("FrontMatter");
    expect(nodeNames("Text\n\n---\ntitle: Notes\n---")).not.toContain("FrontMatter");
  });

  it("reads footnotes rather than links", () => {
    const names = nodeNames("A claim.[^1]\n\n[^1]: The source.");
    expect(names).toContain("FootnoteReference");
    expect(names).toContain("FootnoteDefinition");
    expect(names).not.toContain("Link");
  });

  it("reads emoji shortcodes, subscripts, superscripts and task lists", () => {
    const names = nodeNames("- [x] H~2~O is 10^3^ :smile:");
    expect(names).toEqual(expect.arrayContaining(["Task", "Subscript", "Superscript", "Emoji"]));
  });
});

/**
 * Pieces of Markdown whose syntax spans several lines or depends on what is around it: where an
 * edit lands among them decides which parts of the old tree the parser may reuse. Tables are left
 * out because of the upstream bug the last test below keeps track of.
 */
const PIECES = [
  "# Heading\n",
  "Setext heading\n===\n",
  "A paragraph with **strong**, *emphasis*, `code` and a [link](https://example.com).\n",
  "Inline $x^2$ and $$display$$ math, ==highlight==, H~2~O, 10^3^, :smile:.\n",
  "A footnote[^note].\n",
  "[^note]: Its definition,\n    continued.\n",
  "---\n",
  "title: Front matter or a heading\n",
  "> A quote\n> over two lines\n",
  "- item\n  - nested\n- [ ] task\n",
  "1. first\n2. second\n",
  "```\ncode\n```\n",
  "$$\nx = 1\n$$\n",
  "<details>\n<summary>More</summary>\n\nHidden\n</details>\n",
  "\n",
  "*",
  "`",
  "$",
  "==",
  "[^",
];

const markdownDocument = fc
  .array(fc.constantFrom(...PIECES), { maxLength: 16 })
  .map((pieces) => pieces.join(""));

describe("incremental parsing", () => {
  it("reads an edited document as it reads the same text from scratch", () => {
    const edit = fc.record({
      at: fc.nat(),
      length: fc.nat({ max: 12 }),
      insert: fc.oneof(fc.constantFrom(...PIECES), fc.string({ maxLength: 6 })),
    });
    fc.assert(
      fc.property(
        markdownDocument,
        fc.array(edit, { minLength: 1, maxLength: 4 }),
        (doc, edits) => {
          let state = markdownState(doc);
          for (const { at, length, insert } of edits) {
            const from = at % (state.doc.length + 1);
            const to = Math.min(state.doc.length, from + length);
            state = updated(state, { changes: { from, to, insert } });
          }
          expect(treeShape(state)).toEqual(treeShape(markdownState(state.doc.toString())));
        },
      ),
      { numRuns: 1000 },
    );
  });

  // @lezer/markdown 1.8.1 reuses a paragraph that a table ended even when the table no longer
  // parses, so the editor shows two paragraphs until the text is read again from scratch. When this
  // starts to pass, the bug is fixed: remove `fails` and put tables back among the pieces above.
  it.fails("reads a paragraph back together when the table after it breaks", () => {
    const doc = `${"x".repeat(120)}\n| a | b |\n| --- | --- |\n`;
    const from = doc.indexOf("| ---");
    const state = updated(markdownState(doc), { changes: { from, to: from + 5 } });
    expect(treeShape(state)).toEqual(treeShape(markdownState(state.doc.toString())));
  });
});
