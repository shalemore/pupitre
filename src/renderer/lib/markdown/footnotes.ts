import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import type { MarkdownConfig } from "@lezer/markdown";

/**
 * Footnotes as GitHub writes them: `[^label]` refers to a definition `[^label]: text`, whose
 * further paragraphs are indented by four spaces. Without this extension the parser would read
 * the reference as a link and the definition as a link reference.
 */

const OPEN_BRACKET = 91;
const CARET = 94;
const CLOSE_BRACKET = 93;
const DEFINITION = /^\[\^([^\]\s]+)\]:/;
/** Indentation that continues a definition, like a list item's. */
const DEFINITION_INDENT = 4;

export const footnotes: MarkdownConfig = {
  defineNodes: [
    { name: "FootnoteReference" },
    { name: "FootnoteMark" },
    {
      name: "FootnoteDefinition",
      block: true,
      composite: (_cx, line, value) => {
        if (line.indent < line.baseIndent + value && line.next > -1) return false;
        line.moveBaseColumn(line.baseIndent + value);
        return true;
      },
    },
    { name: "FootnoteLabel" },
  ],
  parseInline: [
    {
      name: "FootnoteReference",
      before: "Link",
      parse(cx, next, start) {
        if (next !== OPEN_BRACKET || cx.char(start + 1) !== CARET) return -1;
        let end = start + 2;
        while (end < cx.end && cx.char(end) !== CLOSE_BRACKET) {
          const char = cx.char(end);
          if (char === OPEN_BRACKET || char === 32 || char === 10 || char === 9) return -1;
          end++;
        }
        if (end === start + 2 || end >= cx.end) return -1;
        return cx.addElement(
          cx.elt("FootnoteReference", start, end + 1, [
            cx.elt("FootnoteMark", start, start + 2),
            cx.elt("FootnoteMark", end, end + 1),
          ]),
        );
      },
    },
  ],
  parseBlock: [
    {
      name: "FootnoteDefinition",
      before: "LinkReference",
      parse(cx, line) {
        const match = DEFINITION.exec(line.text.slice(line.pos));
        if (!match) return false;
        const start = cx.lineStart + line.pos;
        cx.startComposite("FootnoteDefinition", line.pos, DEFINITION_INDENT);
        cx.addElement(cx.elt("FootnoteLabel", start, start + match[0].length));
        line.moveBase(line.pos + match[0].length);
        return null;
      },
    },
  ],
};

/** The label of a footnote reference or definition label node (`[^label]` or `[^label]:`). */
export function footnoteLabel(state: EditorState, node: SyntaxNode): string {
  return state.sliceDoc(node.from, node.to).replace(/^\[\^|\]:?$/g, "");
}

/** The end of every reference to a footnote, in document order, where a back arrow lands. */
export function footnoteReferences(state: EditorState, label: string): number[] {
  const ends: number[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "FootnoteReference") return;
      if (footnoteLabel(state, node.node) === label) ends.push(node.to);
    },
  });
  return ends;
}

/**
 * Where a footnote jump lands: from a reference to the text of its definition, from a definition
 * to just after its first reference, like the links GitHub renders.
 */
export function footnoteTarget(state: EditorState, node: SyntaxNode): number | undefined {
  const label = footnoteLabel(state, node);
  const wanted = node.name === "FootnoteReference" ? "FootnoteLabel" : "FootnoteReference";
  let target: number | undefined;
  syntaxTree(state).iterate({
    enter: (other) => {
      if (target !== undefined) return false;
      if (other.name !== wanted || footnoteLabel(state, other.node) !== label) return true;
      target = other.to;
      return false;
    },
  });
  return target;
}
