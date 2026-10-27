import { syntaxTree } from "@codemirror/language";
import {
  Annotation,
  type ChangeSpec,
  type EditorState,
  type Extension,
  Transaction,
} from "@codemirror/state";
import { type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

/** Marks the change that writes the numbers, so it does not ask for another renumbering. */
const renumbered = Annotation.define<boolean>();

/**
 * The changes that make the numbers written in the ordered lists touched by `ranges` count from
 * one again. A list elsewhere in the document keeps the numbers it was written with, so a page
 * that starts at 5 does not change because a list above was edited.
 */
export function orderedListNumbers(
  state: EditorState,
  ranges: readonly { from: number; to: number }[],
): ChangeSpec[] {
  const changes: ChangeSpec[] = [];
  // A change point stands at the start of the line it left behind; the line takes in the indent
  // a nested list begins after, which the change alone would not reach
  const lines = ranges.map((range) => ({
    from: state.doc.lineAt(range.from).from,
    to: state.doc.lineAt(range.to).to,
  }));
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "OrderedList") return true;
      const touched = lines.some((line) => node.from <= line.to && node.to >= line.from);
      if (!touched) return false;
      let number = 0;
      for (let item = node.node.firstChild; item; item = item.nextSibling) {
        if (item.name !== "ListItem") continue;
        number += 1;
        const mark = item.getChild("ListMark");
        if (!mark) continue;
        const source = state.sliceDoc(mark.from, mark.to);
        const delimiter = /^\d+([.)])$/.exec(source)?.[1];
        if (delimiter === undefined) continue;
        const wanted = `${number}${delimiter}`;
        if (source !== wanted) changes.push({ from: mark.from, to: mark.to, insert: wanted });
      }
      return true;
    },
  });
  return changes;
}

/**
 * Renumbers the ordered lists an edit touched, so the number written on the line being edited
 * counts from one as the rendered numbers beside it do. The change goes into the document after
 * the edit, without a history entry of its own, so one Undo takes both back together.
 */
export function renumberOrderedLists(): Extension {
  return ViewPlugin.fromClass(
    class {
      private ranges: { from: number; to: number }[] = [];
      private frame: number | undefined;

      constructor(private readonly view: EditorView) {}

      update(update: ViewUpdate): void {
        if (!update.docChanged) return;
        // A file replacing the text is not an edit of its lists: opening a document must not
        // rewrite the numbers it was written with
        const edited = update.transactions.some(
          (transaction) =>
            transaction.annotation(Transaction.userEvent) !== undefined &&
            transaction.annotation(renumbered) !== true,
        );
        if (!edited) return;
        update.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
          this.ranges.push({ from: fromB, to: toB });
        });
        if (this.frame !== undefined) return;
        this.frame = requestAnimationFrame(() => {
          this.frame = undefined;
          const changes = orderedListNumbers(this.view.state, this.ranges);
          this.ranges = [];
          if (changes.length === 0) return;
          this.view.dispatch({
            changes,
            annotations: [renumbered.of(true), Transaction.addToHistory.of(false)],
          });
        });
      }

      destroy(): void {
        if (this.frame !== undefined) cancelAnimationFrame(this.frame);
      }
    },
  );
}
