import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";

/**
 * The text from `from` to `to` of a block, without the markers of the quote or the list it is in:
 * every line of a block starts at the column the block itself starts at. A fenced block's code
 * needs none of this, the tree leaves those markers out of it already (see {@link fencedText}).
 */
export function blockText(state: EditorState, block: SyntaxNode, from: number, to: number): string {
  const { doc } = state;
  const column = block.from - doc.lineAt(block.from).from;
  const lines: string[] = [];
  for (let line = doc.lineAt(from); ; line = doc.line(line.number + 1)) {
    const start = Math.max(from, line.from + column);
    lines.push(start < to ? state.sliceDoc(start, Math.min(to, line.to)) : "");
    if (line.to >= to || line.number === doc.lines) return lines.join("\n");
  }
}

/**
 * The code of a fenced block, without its fences. Inside a quote or a list the tree splits it into
 * one CodeText per line, with the markers of the container between them and the newline that ends
 * each line at its end, so the pieces are joined as they are.
 */
export function fencedText(state: EditorState, node: SyntaxNode): string {
  return node
    .getChildren("CodeText")
    .map((code) => state.sliceDoc(code.from, code.to))
    .join("");
}
