import { syntaxTree } from "@codemirror/language";
import { type Extension, type Range, StateField, type Text } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { direction } from "direction";

/**
 * Bidirectional text, handled in one place.
 *
 * Every line gets dir="auto", the base direction of its first strong character, the rule the
 * Unicode Bidirectional Algorithm uses for paragraphs. That keeps an Arabic paragraph
 * right-aligned in an English document and a Chinese paragraph left-aligned in an Arabic
 * interface; Markdown markers are neutral characters and do not change it. Lines without strong
 * characters (empty lines, numbers) inherit the direction of the document, taken from its opening
 * text so empty lines line up with the text around them. Code and front matter are always
 * left-to-right; inline code is isolated in CSS (features/editor/editor.css).
 */

const LTR_BLOCK = /^(?:FencedCode|CodeBlock|FrontMatter)$/;
const DIRECTION_SAMPLE = 4096;

/**
 * The base direction of `doc`, or undefined when its opening text holds no strong character. Only
 * that opening text is read: the first strong character is almost always near the start, and
 * typing must stay cheap.
 */
export function baseDirection(doc: Text): "ltr" | "rtl" | undefined {
  const dir = direction(doc.sliceString(0, DIRECTION_SAMPLE));
  return dir === "neutral" ? undefined : dir;
}

const autoLine = Decoration.line({ attributes: { dir: "auto" } });
const ltrLine = Decoration.line({ attributes: { dir: "ltr" } });

function lineDirections(view: EditorView): DecorationSet {
  const { doc } = view.state;
  const { from, to } = view.viewport;
  const ltrLines = new Set<number>();
  syntaxTree(view.state).iterate({
    from,
    to,
    enter: (node) => {
      if (!LTR_BLOCK.test(node.name)) return node.name !== "Paragraph";
      const last = doc.lineAt(Math.min(node.to, to)).number;
      for (let line = doc.lineAt(Math.max(node.from, from)).number; line <= last; line++) {
        ltrLines.add(line);
      }
      return false;
    },
  });
  const decorations: Range<Decoration>[] = [];
  for (let pos = from; pos <= to;) {
    const line = doc.lineAt(pos);
    decorations.push((ltrLines.has(line.number) ? ltrLine : autoLine).range(line.from));
    pos = line.to + 1;
  }
  return Decoration.set(decorations);
}

const documentDirection = StateField.define<"ltr" | "rtl" | undefined>({
  create: (state) => baseDirection(state.doc),
  update: (dir, tr) =>
    tr.docChanged && tr.changes.touchesRange(0, DIRECTION_SAMPLE)
      ? baseDirection(tr.state.doc)
      : dir,
});

export const textDirection: Extension = [
  EditorView.perLineTextDirection.of(true),
  documentDirection,
  EditorView.contentAttributes.compute([documentDirection], (state): Record<string, string> => {
    const dir = state.field(documentDirection);
    return dir === undefined ? {} : { dir };
  }),
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = lineDirections(view);
      }

      update(update: ViewUpdate): void {
        if (
          update.docChanged ||
          update.viewportChanged ||
          syntaxTree(update.state) !== syntaxTree(update.startState)
        ) {
          this.decorations = lineDirections(update.view);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  ),
];
