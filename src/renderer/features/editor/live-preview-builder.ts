import {
  type EditorState,
  type Range,
  type SelectionRange,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { Decoration, type DecorationSet, type EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { detailsAnimation } from "@/lib/markdown/details";

/**
 * The decoration builder the live preview fills while it walks the syntax tree: line classes and
 * attributes, hidden markers, and the blank lines that read as the gaps between blocks. The
 * printing switch lives here too, because the builder reads it whenever it reveals syntax.
 */

const hidden = Decoration.replace({});
const syntax = Decoration.mark({ class: "md-mark" });

interface LineStyle {
  classes: Set<string>;
  attributes: Record<string, string>;
  quoteDepth: number;
  listDepth: number;
  /** Leading whitespace of a list line that is replaced by the list indentation. */
  listIndent: number;
}

/** Turned on while the document is printed, when every construct shows rendered. */
export const setPrinting = StateEffect.define<boolean>();

export const printing = StateField.define<boolean>({
  create: () => false,
  update: (value, tr) =>
    tr.effects.reduce(
      (current, effect) => (effect.is(setPrinting) ? effect.value : current),
      value,
    ),
});

/** Whether printing was turned on or off by this update. */
export function printingChanged(state: EditorState, previous: EditorState): boolean {
  return state.field(printing, false) !== previous.field(printing, false);
}
/** The selection ranges that reveal syntax; none while printing. */
export function revealingRanges(state: EditorState): readonly SelectionRange[] {
  return state.field(printing, false) ? [] : state.selection.ranges;
}

export function touches(ranges: readonly SelectionRange[], from: number, to: number): boolean {
  return ranges.some((range) => range.from <= to && range.to >= from);
}

/**
 * The range of whole lines a block covers. A block that shows as a rendering takes those lines, the
 * markers of a quote or a list around it included, so a cursor anywhere on them is in it.
 */
export function lineRange(state: EditorState, node: SyntaxNode): [number, number] {
  return [state.doc.lineAt(node.from).from, state.doc.lineAt(node.to).to];
}
export class DecorationBuilder {
  readonly decorations: Range<Decoration>[] = [];
  /** Starts of alert markers (`[!NOTE]`), which would otherwise read as links. */
  readonly alertMarkers = new Set<number>();
  hasFootnoteDefinition = false;
  private readonly lines = new Map<number, LineStyle>();
  readonly state: EditorState;

  constructor(
    view: EditorView,
    readonly from: number,
    readonly to: number,
    /** Lines an edit just opened empty inside a code block; they grow into place. */
    readonly growing: ReadonlySet<number>,
  ) {
    this.state = view.state;
  }

  get ranges(): readonly SelectionRange[] {
    return revealingRanges(this.state);
  }

  lineAt(pos: number) {
    return this.state.doc.lineAt(pos);
  }

  /** Runs `style` for each line of a range that is inside the rendered window. */
  eachLine(from: number, to: number, style: (line: LineStyle, number: number) => void): void {
    const doc = this.state.doc;
    const first = doc.lineAt(Math.max(from, this.from)).number;
    const last = doc.lineAt(Math.min(to, this.to)).number;
    for (let number = first; number <= last; number++) {
      const start = doc.line(number).from;
      let line = this.lines.get(start);
      if (!line) {
        line = { classes: new Set(), attributes: {}, quoteDepth: 0, listDepth: 0, listIndent: 0 };
        this.lines.set(start, line);
      }
      style(line, number);
    }
  }

  lineClass(from: number, to: number, className: string): void {
    this.eachLine(from, to, (line) => {
      for (const name of className.split(" ")) line.classes.add(name);
    });
  }

  hide(from: number, to: number): void {
    if (to > from) this.decorations.push(hidden.range(from, to));
  }

  mark(
    from: number,
    to: number,
    className: string,
    attributes?: Readonly<Record<string, string>>,
  ): void {
    if (to > from) {
      this.decorations.push(
        Decoration.mark({ class: className, ...(attributes && { attributes }) }).range(from, to),
      );
    }
  }

  /** Shows the marker as source when `active`, hides it (and `extra` characters after it) otherwise. */
  marker(
    node: { from: number; to: number },
    active: boolean,
    extra = 0,
    mark: Decoration = syntax,
  ): void {
    if (active) this.decorations.push(mark.range(node.from, node.to));
    else this.hide(node.from, node.to + extra);
  }

  /** 1 when a space follows `pos`, so a hidden marker takes its separating space along. */
  spaceAfter(pos: number): number {
    return this.state.sliceDoc(pos, pos + 1) === " " ? 1 : 0;
  }

  text(from: number, to: number): string {
    return this.state.sliceDoc(from, to);
  }

  /**
   * A blank line between blocks reads as the space between them, the way the blocks would be set
   * apart once rendered; it opens up as an empty line while the selection is on it. Lines inside
   * code, HTML and front matter keep their height, since there the blank line is content.
   */
  collapseBlankLines(): void {
    const { doc } = this.state;
    if (doc.lines === 1) return;
    for (let pos = this.from; pos <= this.to;) {
      const line = doc.lineAt(pos);
      pos = line.to + 1;
      if (line.text.trim() !== "" || touches(this.ranges, line.from, line.to)) continue;
      const classes = this.lines.get(line.from)?.classes;
      if (classes && ["md-code-block", "md-html", "md-front-matter"].some((c) => classes.has(c))) {
        continue;
      }
      this.lineClass(line.from, line.from, "md-blank");
    }
  }

  finish(): DecorationSet {
    this.collapseBlankLines();
    const animation = this.state.field(detailsAnimation, false);
    // A line of the folding content is decorated even when nothing else marks it
    if (animation !== undefined && animation.from <= animation.to) {
      this.eachLine(animation.from, animation.to, () => {});
    }
    for (const [start, line] of this.lines) {
      const leading = /^[ \t]*/.exec(this.lineAt(start).text)?.[0].length ?? 0;
      this.hide(start, start + Math.min(leading, line.listIndent));
      // Depths are exposed as attributes for selectors and as variables for indentation
      const attributes = { ...line.attributes };
      const variables: string[] = [];
      if (line.quoteDepth > 0) {
        attributes["data-quote-depth"] = String(line.quoteDepth);
        variables.push(`--md-quote-depth: ${line.quoteDepth}`);
      }
      if (line.listDepth > 0) {
        attributes["data-list-depth"] = String(line.listDepth);
        variables.push(`--md-list-depth: ${line.listDepth}`);
      }
      if (variables.length > 0) attributes["style"] = variables.join("; ");
      if (this.growing.has(start)) line.classes.add("md-code-line-in");
      if (animation !== undefined && start >= animation.from && start <= animation.to) {
        line.classes.add(animation.closing ? "md-details-closing" : "md-details-opening");
      }
      if (line.classes.size > 0) attributes["class"] = [...line.classes].join(" ");
      this.decorations.push(Decoration.line({ attributes }).range(start));
    }
    return Decoration.set(this.decorations, true);
  }
}
