import { syntaxTree } from "@codemirror/language";
import {
  EditorSelection,
  EditorState,
  type Extension,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import type { Settings } from "@shared/settings";

/**
 * Writing modes, each a self-contained extension that the editor switches with a compartment
 * when its setting changes.
 */

/** Blocks that focus mode treats as one unit; anything else is focused line by line. */
const FOCUS_BLOCK =
  /^(?:Paragraph|(?:ATX|Setext)Heading\d|FencedCode|CodeBlock|HTMLBlock|CommentBlock|Table|FrontMatter|LinkReference)$/;

const currentLine = Decoration.line({ class: "is-current" });

/** The start of every line from the one holding `from` to the one holding `to`. */
function lineStarts(state: EditorState, from: number, to: number): number[] {
  const starts: number[] = [];
  for (let pos = from; pos <= to;) {
    const line = state.doc.lineAt(pos);
    starts.push(line.from);
    pos = line.to + 1;
  }
  return starts;
}

/** The block that focus mode treats as one unit around `pos`, or just its line. */
function blockAt(state: EditorState, pos: number, side: -1 | 1): { from: number; to: number } {
  for (let node = syntaxTree(state).resolveInner(pos, side); node.parent; node = node.parent) {
    if (FOCUS_BLOCK.test(node.name)) return { from: node.from, to: node.to };
  }
  const { from } = state.doc.lineAt(pos);
  return { from, to: from };
}

/** The lines focus mode keeps sharp: those the selection covers, or those of the blocks it touches. */
function focusedLines(state: EditorState, grain: Settings["focusModeGrain"]): number[] {
  const { from, to, empty } = state.selection.main;
  // A selection that ends at the start of a line, as a triple-click leaves it, stops short of that line
  const end = empty || state.doc.lineAt(to).from !== to ? to : to - 1;
  if (grain === "line") return lineStarts(state, from, end);
  const first = blockAt(state, from, empty ? -1 : 1);
  const last = blockAt(state, end, -1);
  return lineStarts(state, first.from, Math.max(first.to, last.to));
}

/** Where the caret's row sits in its line, when that line fills more than one row. */
interface RowBand {
  /** Start of the line the band belongs to. */
  from: number;
  /** The row's index among the line's rows. */
  row: number;
  /** The line's top padding, above the first row. */
  pad: number;
}

const setRowBand = StateEffect.define<RowBand | undefined>();

const rowBand = StateField.define<RowBand | undefined>({
  create: () => undefined,
  update(band, tr) {
    for (const effect of tr.effects) if (effect.is(setRowBand)) return effect.value;
    // A new position gets a row of its own, which is measured next
    return tr.docChanged || tr.selection ? undefined : band;
  },
});

const sameRow = (a: RowBand | undefined, b: RowBand | undefined) =>
  a === b ||
  (a !== undefined && b !== undefined && a.from === b.from && a.row === b.row && a.pad === b.pad);

/**
 * The row the caret is on inside a line that wraps, or undefined when the line is one row. Nothing
 * is counted out by hand: CodeMirror knows where a wrapped line breaks, and a row starts where the
 * one above it ends.
 */
function measureRow(view: EditorView): RowBand | undefined {
  const { head, empty } = view.state.selection.main;
  if (!empty) return undefined;
  const line = view.state.doc.lineAt(head);
  const rowStart = view.moveToLineBoundary(EditorSelection.cursor(head), false, true).head;
  const rowEnd = view.moveToLineBoundary(EditorSelection.cursor(head), true, true).head;
  // The row spans its line when the line does not wrap
  if (rowStart === line.from && rowEnd === line.to) return undefined;
  // A row starts where the one above it ends
  let row = 0;
  for (let from = line.from; from < rowStart;) {
    const end = view.moveToLineBoundary(EditorSelection.cursor(from), true, true).head;
    if (end <= from) break;
    from = end;
    row++;
  }
  const node = view.domAtPos(head).node;
  const element = node instanceof Element ? node : node.parentElement;
  const lineElement = element?.closest(".cm-line");
  const pad = lineElement ? Number.parseFloat(getComputedStyle(lineElement).paddingBlockStart) : 0;
  return { from: line.from, row, pad: Number.isNaN(pad) ? 0 : pad };
}

/** Measures after the update, since the layout cannot be read during one. */
function rowMeasure(grain: Settings["focusModeGrain"]): Extension {
  return ViewPlugin.fromClass(
    class {
      private frame = 0;

      constructor(view: EditorView) {
        this.measure(view);
      }

      update(update: ViewUpdate): void {
        if (
          update.docChanged ||
          update.selectionSet ||
          update.geometryChanged ||
          update.viewportChanged
        ) {
          this.measure(update.view);
        }
      }

      destroy(): void {
        cancelAnimationFrame(this.frame);
      }

      private measure(view: EditorView): void {
        if (grain !== "line") return;
        cancelAnimationFrame(this.frame);
        this.frame = requestAnimationFrame(() => {
          const band = measureRow(view);
          if (!sameRow(band, view.state.field(rowBand))) {
            view.dispatch({ effects: setRowBand.of(band) });
          }
        });
      }
    },
  );
}

function focusDecorations(state: EditorState, grain: Settings["focusModeGrain"]): DecorationSet {
  const band = grain === "line" ? state.field(rowBand) : undefined;
  const decorations = focusedLines(state, grain).map((from) => {
    if (band === undefined || band.from !== from) return currentLine.range(from);
    return Decoration.line({
      class: "is-current focus-row",
      attributes: { style: `--focus-row: ${band.row}; --focus-pad: ${band.pad}px` },
    }).range(from);
  });
  return Decoration.set(decorations);
}

/**
 * Focus mode: everything except the line being written is dimmed, or except the whole block around
 * it; within a line that wraps over several rows, only the row the caret is on stays sharp. The
 * dimming itself is CSS (editor.css), and so is the band that keeps that row.
 */
export function focusMode(grain: Settings["focusModeGrain"]): Extension {
  return [
    EditorView.contentAttributes.of({ class: "focus-mode" }),
    rowBand,
    EditorView.decorations.compute([rowBand, "selection"], (state) =>
      focusDecorations(state, grain),
    ),
    rowMeasure(grain),
  ];
}

/** Where typewriter mode holds the line, and how far from the window edge for the top and bottom. */
const TYPEWRITER_ALIGN: Record<Settings["typewriterPosition"], "center" | "start" | "end"> = {
  center: "center",
  top: "start",
  bottom: "end",
};
const TYPEWRITER_EDGE_MARGIN = 64;

/** The scroll that puts the line holding `head` where typewriter mode holds it. */
export function holdLine(head: number, position: Settings["typewriterPosition"]) {
  return EditorView.scrollIntoView(head, {
    y: TYPEWRITER_ALIGN[position],
    yMargin: position === "center" ? 5 : TYPEWRITER_EDGE_MARGIN,
  });
}

/**
 * Typewriter mode: the line being written stays at one place in the window, the middle, near the
 * top or near the bottom, and the text moves instead of the cursor. Room below the document
 * (editor.css) lets the last lines reach that place; `fixed` leaves room above and below as well,
 * so the first ones reach it too. Selections made with the mouse are left where they are,
 * otherwise the text would jump away from the pointer.
 */
export function typewriterMode(
  position: Settings["typewriterPosition"],
  fixed: boolean,
): Extension {
  return [
    // The stylesheet needs the edge margin to leave exactly that much room above the first line
    EditorView.contentAttributes.of({
      class: "typewriter-mode",
      "data-typewriter": position,
      "data-typewriter-fixed": String(fixed),
      style: `--typewriter-edge: ${TYPEWRITER_EDGE_MARGIN}px`,
    }),
    EditorState.transactionExtender.of((tr) =>
      (tr.docChanged || tr.selection) && !tr.isUserEvent("select.pointer")
        ? { effects: holdLine(tr.newSelection.main.head, position) }
        : null,
    ),
  ];
}
