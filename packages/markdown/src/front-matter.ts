import type { MarkdownConfig } from "@lezer/markdown";

const OPENING_FENCE = /^---[ \t]*$/;
const CLOSING_FENCE = /^(?:---|\.\.\.)[ \t]*$/;

/**
 * YAML front matter: a `---` fence on the very first line of the file opens it and the next `---`
 * or `...` line closes it. Without this, the parser would read the block as a rule followed by a
 * setext heading. The parser cannot look ahead, so a fence that is never closed runs to the end of
 * the document, the way it does in Typora.
 */
export const frontMatter: MarkdownConfig = {
  defineNodes: [{ name: "FrontMatter", block: true }, { name: "FrontMatterMark" }],
  parseBlock: [
    {
      name: "FrontMatter",
      before: "HorizontalRule",
      parse(cx, line) {
        if (cx.lineStart !== 0 || cx.depth !== 1 || !OPENING_FENCE.test(line.text)) return false;
        const marks = [cx.elt("FrontMatterMark", 0, 3)];
        let end = line.text.length;
        while (cx.nextLine()) {
          end = cx.lineStart + line.text.length;
          if (CLOSING_FENCE.test(line.text)) {
            marks.push(cx.elt("FrontMatterMark", cx.lineStart, cx.lineStart + 3));
            cx.nextLine();
            break;
          }
        }
        cx.addElement(cx.elt("FrontMatter", 0, end, marks));
        return true;
      },
    },
  ],
};
