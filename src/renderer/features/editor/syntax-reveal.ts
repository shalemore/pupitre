import type { Mark, Node } from "@milkdown/kit/prose/model";
import { type EditorState, Plugin } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";

/**
 * Typora-style editing: the Markdown syntax of the heading or inline format under the cursor is
 * shown next to the rendered text (`## `, `**`, `` ` ``, `[`…`](url)`), and it behaves as if it
 * were text. Backspace right after an opening marker removes that format, typing `#` at the start
 * of a heading raises its level, Backspace there lowers it.
 *
 * The markers are widgets, not document content, so the document stays clean Markdown and the
 * serializer remains the only place that decides how syntax is written.
 */

export interface SyntaxStyle {
  strong: string;
  emphasis: string;
}

interface MarkRange {
  mark: Mark;
  from: number;
  to: number;
}

function markSyntax(mark: Mark, style: SyntaxStyle): [string, string] | undefined {
  switch (mark.type.name) {
    case "strong":
      return [style.strong, style.strong];
    case "emphasis":
      return [style.emphasis, style.emphasis];
    case "inlineCode":
      return ["`", "`"];
    case "strike_through":
      return ["~~", "~~"];
    case "link":
      return ["[", `](${String(mark.attrs["href"] ?? "")})`];
    default:
      return undefined;
  }
}

/** Contiguous runs of each mark inside one text block, in document positions. */
function markRanges(block: Node, blockStart: number): MarkRange[] {
  const finished: MarkRange[] = [];
  let running: MarkRange[] = [];
  block.forEach((child, offset) => {
    const from = blockStart + offset;
    const to = from + child.nodeSize;
    const next = child.marks.map((mark) => {
      const continued = running.find((range) => range.mark.eq(mark));
      if (!continued) return { mark, from, to };
      continued.to = to;
      return continued;
    });
    finished.push(...running.filter((range) => !next.includes(range)));
    running = next;
  });
  return [...finished, ...running];
}

function syntaxWidget(text: string): HTMLElement {
  const element = document.createElement("span");
  element.className = "md-syntax";
  element.textContent = text;
  return element;
}

function activeRanges(
  state: EditorState,
): { block: Node; start: number; ranges: MarkRange[] } | undefined {
  const { $head } = state.selection;
  if (!$head.parent.isTextblock || $head.parent.type.spec.code) return undefined;
  const start = $head.start();
  const head = $head.pos;
  const ranges = markRanges($head.parent, start).filter(
    ({ from, to }) => from <= head && head <= to,
  );
  return { block: $head.parent, start, ranges };
}

function buildDecorations(state: EditorState, style: SyntaxStyle): DecorationSet {
  const active = activeRanges(state);
  if (!active) return DecorationSet.empty;
  const decorations: Decoration[] = [];

  if (active.block.type.name === "heading") {
    const level = Number(active.block.attrs["level"]);
    const marker = `${"#".repeat(level)} `;
    decorations.push(
      Decoration.widget(active.start, () => syntaxWidget(marker), { side: -1000, key: marker }),
    );
  }

  // Outer formats open first and close last; sides order widgets that share a position
  const ordered = active.ranges.toSorted((a, b) => a.from - b.from || b.to - a.to);
  ordered.forEach((range, depth) => {
    const syntax = markSyntax(range.mark, style);
    if (!syntax) return;
    const [opening, closing] = syntax;
    decorations.push(
      Decoration.widget(range.from, () => syntaxWidget(opening), {
        side: -100 + depth,
        key: `open-${range.from}-${opening}`,
      }),
      Decoration.widget(range.to, () => syntaxWidget(closing), {
        side: 100 - depth,
        key: `close-${range.to}-${closing}`,
      }),
    );
  });
  return DecorationSet.create(state.doc, decorations);
}

/** Backspace right after an opening marker, or Delete right before a closing one, unformats. */
function removeFormatAtCursor(view: EditorView, key: "Backspace" | "Delete"): boolean {
  const { state } = view;
  if (!state.selection.empty) return false;
  const active = activeRanges(state);
  if (!active) return false;
  const head = state.selection.head;

  if (key === "Backspace" && active.block.type.name === "heading" && head === active.start) {
    const level = Number(active.block.attrs["level"]);
    const position = active.start - 1;
    const paragraph = state.schema.nodes["paragraph"];
    const tr =
      level > 1
        ? state.tr.setNodeMarkup(position, undefined, { ...active.block.attrs, level: level - 1 })
        : paragraph
          ? state.tr.setNodeMarkup(position, paragraph)
          : undefined;
    if (!tr) return false;
    view.dispatch(tr);
    return true;
  }

  const range = active.ranges.find((candidate) =>
    key === "Backspace" ? candidate.from === head : candidate.to === head,
  );
  if (!range) return false;
  view.dispatch(state.tr.removeMark(range.from, range.to, range.mark));
  return true;
}

export function syntaxRevealPlugin(style: () => SyntaxStyle): Plugin {
  return new Plugin({
    props: {
      decorations: (state) => buildDecorations(state, style()),
      handleKeyDown: (view, event) => {
        if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return false;
        if (event.key !== "Backspace" && event.key !== "Delete") return false;
        return removeFormatAtCursor(view, event.key);
      },
      handleTextInput: (view, from, to, text) => {
        // Typing "#" at the start of a heading adds one level, like editing the hidden marker
        const { $from } = view.state.selection;
        if (text !== "#" || from !== to || $from.parent.type.name !== "heading") return false;
        if (from !== $from.start()) return false;
        const level = Number($from.parent.attrs["level"]);
        if (level >= 6) return false;
        view.dispatch(
          view.state.tr.setNodeMarkup($from.before(), undefined, {
            ...$from.parent.attrs,
            level: level + 1,
          }),
        );
        return true;
      },
    },
  });
}
