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
import type { Settings } from "@pupitre/settings";

/**
 * Writing modes, each a self-contained extension that the editor switches with a compartment
 * when its setting changes.
 */

/** Blocks that focus mode treats as one unit; anything else is focused line by line. */
const FOCUS_BLOCK =
  /^(?:Paragraph|(?:ATX|Setext)Heading\d|FencedCode|CodeBlock|HTMLBlock|CommentBlock|Table|FrontMatter|LinkReference)$/;

const currentLine = Decoration.line({ class: "is-current" });

/** The start of every line in the viewport from the one holding `from` to the one holding `to`. */
function lineStarts(
  state: EditorState,
  from: number,
  to: number,
  viewport: { from: number; to: number },
): number[] {
  const start = Math.max(from, viewport.from);
  const end = Math.min(to, viewport.to);
  if (start > end) return [];
  const starts: number[] = [];
  for (let pos = start; pos <= end;) {
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
function focusedLines(view: EditorView, grain: Settings["focusModeGrain"]): number[] {
  const { state, viewport } = view;
  const { from, to, empty } = state.selection.main;
  // A selection that ends at the start of a line, as a triple-click leaves it, stops short of that line
  const end = empty || state.doc.lineAt(to).from !== to ? to : to - 1;
  if (grain === "line") return lineStarts(state, from, end, viewport);
  const first = blockAt(state, from, empty ? -1 : 1);
  const last = blockAt(state, end, -1);
  return lineStarts(state, first.from, Math.max(first.to, last.to), viewport);
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

function focusDecorations(view: EditorView, grain: Settings["focusModeGrain"]): DecorationSet {
  const band = grain === "line" ? view.state.field(rowBand) : undefined;
  const decorations = focusedLines(view, grain).map((from) => {
    if (band === undefined || band.from !== from) return currentLine.range(from);
    return Decoration.line({
      class: "is-current focus-row",
      attributes: { style: `--focus-row: ${band.row}; --focus-pad: ${band.pad}px` },
    }).range(from);
  });
  return Decoration.set(decorations);
}

/** Decorates the focused lines in the viewport and measures the active row after layout settles. */
function focusPlugin(grain: Settings["focusModeGrain"]): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private frame = 0;

      constructor(view: EditorView) {
        this.decorations = focusDecorations(view, grain);
        this.measure(view);
      }

      update(update: ViewUpdate): void {
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          update.state.field(rowBand) !== update.startState.field(rowBand)
        ) {
          this.decorations = focusDecorations(update.view, grain);
        }
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
    { decorations: (plugin) => plugin.decorations },
  );
}

/**
 * Focus mode: everything except the line being written is dimmed, or except the whole block around
 * it; within a line that wraps over several rows, only the row the caret is on stays sharp. The
 * dimming itself is CSS (editor.css), and so is the band that keeps that row.
 */
export function focusMode(grain: Settings["focusModeGrain"]): Extension {
  return [EditorView.contentAttributes.of({ class: "focus-mode" }), rowBand, focusPlugin(grain)];
}

/** Where typewriter mode holds the line, and how far from the window edge for the top and bottom. */
const TYPEWRITER_ALIGN: Record<Settings["typewriterPosition"], "center" | "start" | "end"> = {
  center: "center",
  top: "start",
  bottom: "end",
};
const TYPEWRITER_EDGE_MARGIN = 64;

/** The scroll that puts the line holding `head` where typewriter mode holds it. */
function holdLine(head: number, position: Settings["typewriterPosition"]) {
  return EditorView.scrollIntoView(head, {
    y: TYPEWRITER_ALIGN[position],
    yMargin: position === "center" ? 5 : TYPEWRITER_EDGE_MARGIN,
  });
}

function prefersSmoothScroll(animations: Settings["animations"]): boolean {
  if (animations === "off") return false;
  if (animations === "on") return true;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function findVerticalScroller(root: HTMLElement): HTMLElement {
  let current: HTMLElement | null = root;
  while (current !== null) {
    const { overflowY } = getComputedStyle(current);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return root;
}

/** Smoothly scrolls the active line to the typewriter hold position when motion is enabled. */
export function scrollToHoldLine(
  view: EditorView,
  head: number,
  position: Settings["typewriterPosition"],
  animations: Settings["animations"],
): void {
  if (!prefersSmoothScroll(animations)) {
    view.dispatch({ effects: holdLine(head, position) });
    return;
  }
  view.requestMeasure({
    read: () => {
      const rect = view.coordsAtPos(head);
      if (rect === null) return null;
      const scroller = findVerticalScroller(view.scrollDOM);
      const box = scroller.getBoundingClientRect();
      const currentY =
        position === "center"
          ? (rect.top + rect.bottom) / 2
          : position === "top"
            ? rect.top
            : rect.bottom;
      const targetY =
        position === "center"
          ? box.top + box.height / 2
          : position === "top"
            ? box.top + TYPEWRITER_EDGE_MARGIN
            : box.bottom - TYPEWRITER_EDGE_MARGIN;
      const delta = currentY - targetY;
      if (Math.abs(delta) < 1) return null;
      return { scroller, top: Math.max(0, scroller.scrollTop + delta) };
    },
    write: (target) => {
      if (target === null) return;
      target.scroller.scrollTo({ top: target.top, behavior: "smooth" });
    },
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
  animations: Settings["animations"],
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
      !prefersSmoothScroll(animations) &&
      (tr.docChanged || tr.selection) &&
      !tr.isUserEvent("select.pointer")
        ? { effects: holdLine(tr.newSelection.main.head, position) }
        : null,
    ),
    EditorView.updateListener.of((update) => {
      if (!prefersSmoothScroll(animations)) return;
      if (!update.docChanged && !update.selectionSet) return;
      if (update.transactions.some((tr) => tr.isUserEvent("select.pointer"))) return;
      scrollToHoldLine(update.view, update.state.selection.main.head, position, animations);
    }),
  ];
}
