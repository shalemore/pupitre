import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { type EditorView, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import type {
  BlockContext,
  LeafBlock,
  LeafBlockParser,
  Line,
  MarkdownConfig,
} from "@lezer/markdown";
import { renderMath } from "./mathjax";

const DOLLAR = 36;
const BACKSLASH = 92;
const isSpace = (char: number) => char === 32 || char === 9 || char === 10 || char === -1;
const isDigit = (char: number) => char >= 48 && char <= 57;

/**
 * TeX math in the syntax most editors share: `$…$` inline, `$$…$$` inline in display style, and
 * a `$$` fence around a block. Like Pandoc, an inline opening `$` must not be followed by a space
 * and a closing one must not follow a space or precede a digit, so prices such as $5 and $10 stay
 * text.
 */
export const math: MarkdownConfig = {
  defineNodes: [{ name: "InlineMath" }, { name: "BlockMath", block: true }, { name: "MathMark" }],
  parseInline: [
    {
      name: "InlineMath",
      before: "Emphasis",
      parse(cx, next, start) {
        if (next !== DOLLAR) return -1;
        const size = cx.char(start + 1) === DOLLAR ? 2 : 1;
        const content = start + size;
        if (size === 1 && isSpace(cx.char(content))) return -1;
        for (let pos = content; pos < cx.end; pos++) {
          const char = cx.char(pos);
          if (char === BACKSLASH) {
            pos++;
            continue;
          }
          if (char !== DOLLAR || pos === content) continue;
          if (
            size === 2
              ? cx.char(pos + 1) !== DOLLAR
              : isSpace(cx.char(pos - 1)) || isDigit(cx.char(pos + 1))
          ) {
            continue;
          }
          const end = pos + size;
          return cx.addElement(
            cx.elt("InlineMath", start, end, [
              cx.elt("MathMark", start, content),
              cx.elt("MathMark", pos, end),
            ]),
          );
        }
        return -1;
      },
    },
  ],
  parseBlock: [
    {
      name: "BlockMath",
      before: "LinkReference",
      leaf: (_cx, leaf) => (leaf.content.startsWith("$$") ? new BlockMathParser(leaf) : null),
      // `$$` also starts a block right after a paragraph line, but closes a block of its own
      endLeaf: (_cx, line, leaf) =>
        line.text.startsWith("$$", line.pos) &&
        !leaf.parsers.some((parser) => parser instanceof BlockMathParser),
    },
  ],
};

/** A trailing `$$` that is not the opening one. */
function closes(text: string, isFirstLine: boolean): boolean {
  const trimmed = text.trimEnd();
  return trimmed.endsWith("$$") && (!isFirstLine || trimmed.length > 4);
}

/**
 * A `$$` block is parsed as a leaf, like a paragraph, so the parser handles quote and list
 * markers on its lines. It closes at the line ending in `$$`; a blank line ends an unclosed one.
 */
class BlockMathParser implements LeafBlockParser {
  private closed: boolean;

  constructor(leaf: LeafBlock) {
    this.closed = closes(leaf.content, true);
  }

  nextLine(cx: BlockContext, line: Line, leaf: LeafBlock): boolean {
    if (this.closed) return this.finish(cx, leaf);
    if (!closes(line.text, false)) return false;
    this.closed = true;
    this.add(cx, leaf, cx.lineStart + line.text.trimEnd().length);
    cx.nextLine();
    return true;
  }

  finish(cx: BlockContext, leaf: LeafBlock): boolean {
    this.add(cx, leaf, cx.prevLineEnd());
    return true;
  }

  private add(cx: BlockContext, leaf: LeafBlock, end: number): void {
    const marks = [cx.elt("MathMark", leaf.start, leaf.start + 2)];
    if (this.closed) marks.push(cx.elt("MathMark", end - 2, end));
    cx.addLeafElement(leaf, cx.elt("BlockMath", leaf.start, end, marks));
  }
}

/** Fenced code blocks in these languages are rendered as display math too. */
const MATH_LANGUAGE = /^(?:math|latex|tex|katex)$/i;

/** The TeX of a fenced code block that names math as its language, if it does. */
export function mathFence(state: EditorState, node: SyntaxNode): string | undefined {
  const info = node.getChild("CodeInfo");
  const code = node.getChild("CodeText");
  if (!info || !code || !MATH_LANGUAGE.test(state.sliceDoc(info.from, info.to).trim())) return;
  return state.sliceDoc(code.from, code.to);
}

/** The TeX of an InlineMath or BlockMath node, and whether it is typeset in display style. */
export function mathOf(state: EditorState, node: SyntaxNode): { tex: string; display: boolean } {
  const marks = node.getChildren("MathMark");
  const open = marks[0];
  const close = marks.at(-1);
  return {
    tex: state.sliceDoc(open?.to ?? node.from, close?.from ?? node.to),
    // `$$…$$` written inline is typeset in display style, as Pandoc does; a fence always is
    display: node.name !== "InlineMath" || (open !== undefined && open.to - open.from === 2),
  };
}

export class MathWidget extends WidgetType {
  constructor(
    readonly tex: string,
    readonly display: boolean,
  ) {
    super();
  }

  override eq(other: MathWidget): boolean {
    return other.tex === this.tex && other.display === this.display;
  }

  toDOM(view: EditorView): HTMLElement {
    const element = document.createElement(this.display ? "div" : "span");
    element.className = this.display ? "md-math-block" : "md-math";
    void renderMath(this.tex, this.display).then((svg) => {
      element.innerHTML = svg;
      view.requestMeasure();
    });
    return element;
  }

  // Dragging the scrollbar of a formula wider than the line must scroll it, not start a selection;
  // a click on the formula itself places the cursor there, which reveals its source
  override ignoreEvent(event: Event): boolean {
    return event.target instanceof Element && event.target.classList.contains("md-math-block");
  }
}

/**
 * Renders every formula of the document ahead of printing: the page is laid out at once, before
 * a formula that is still loading could arrive.
 */
export async function prerenderMath(state: EditorState): Promise<void> {
  const formulas: { tex: string; display: boolean }[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === "InlineMath" || node.name === "BlockMath") {
        formulas.push(mathOf(state, node.node));
        return;
      }
      const fence = node.name === "FencedCode" ? mathFence(state, node.node) : undefined;
      if (fence !== undefined) formulas.push({ tex: fence, display: true });
    },
  });
  await Promise.all(formulas.map(({ tex, display }) => renderMath(tex, display)));
}
