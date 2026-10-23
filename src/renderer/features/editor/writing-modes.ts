import { syntaxTree } from "@codemirror/language";
import { EditorState, type Extension, type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

/**
 * Writing modes, each a self-contained extension that the editor switches with a compartment
 * when its setting changes.
 */

/** Blocks that focus mode treats as one unit; anything else is focused line by line. */
const FOCUS_BLOCK =
  /^(?:Paragraph|(?:ATX|Setext)Heading\d|FencedCode|CodeBlock|HTMLBlock|CommentBlock|Table|FrontMatter|LinkReference)$/;

const currentLine = Decoration.line({ class: "is-current" });

function currentBlock(view: EditorView): DecorationSet {
  const { state } = view;
  const head = state.selection.main.head;
  let from = state.doc.lineAt(head).from;
  let to = from;
  for (let node = syntaxTree(state).resolveInner(head, -1); node.parent; node = node.parent) {
    if (FOCUS_BLOCK.test(node.name)) {
      ({ from, to } = node);
      break;
    }
  }
  const decorations: Range<Decoration>[] = [];
  for (let pos = from; pos <= to;) {
    const line = state.doc.lineAt(pos);
    decorations.push(currentLine.range(line.from));
    pos = line.to + 1;
  }
  return Decoration.set(decorations);
}

/**
 * Focus mode: every block except the one being written is dimmed. Only the lines of the current
 * block are decorated; the dimming itself is CSS (editor.css).
 */
export const focusMode: Extension = [
  EditorView.contentAttributes.of({ class: "focus-mode" }),
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = currentBlock(view);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.selectionSet) this.decorations = currentBlock(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  ),
];

/**
 * Typewriter mode: the line being written stays in the vertical middle of the window and the
 * text moves instead of the cursor. Extra space below the document (editor.css) lets the last
 * lines reach the middle too. Selections made with the mouse are left where they are, otherwise
 * the text would jump away from the pointer while dragging.
 */
export const typewriterMode: Extension = [
  EditorView.contentAttributes.of({ class: "typewriter-mode" }),
  EditorState.transactionExtender.of((tr) =>
    (tr.docChanged || tr.selection) && !tr.isUserEvent("select.pointer")
      ? { effects: EditorView.scrollIntoView(tr.newSelection.main.head, { y: "center" }) }
      : null,
  ),
];
