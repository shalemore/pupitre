import { WidgetType } from "@codemirror/view";
import type {
  BlockContext,
  LeafBlock,
  LeafBlockParser,
  Line,
  MarkdownConfig,
} from "@lezer/markdown";
import katex from "katex";
import "katex/contrib/mhchem";

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
export const MATH_LANGUAGE = /^(?:math|latex|tex|katex)$/i;

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

  toDOM(): HTMLElement {
    const element = document.createElement(this.display ? "div" : "span");
    element.className = this.display ? "md-math-block" : "md-math";
    katex.render(this.tex, element, { displayMode: this.display, throwOnError: false });
    return element;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

/** Loads KaTeX's fonts, which the browser otherwise fetches only once a formula is on screen. */
export async function loadMathFonts(): Promise<void> {
  const faces = [...document.fonts].filter((face) => face.family.startsWith("KaTeX"));
  await Promise.allSettled(faces.map((face) => face.load()));
}
