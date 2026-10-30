import type { EditorState } from "@codemirror/state";
import { Decoration, type EditorView, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { AlertTitleWidget } from "@/features/editor/widgets/alert-widget";
import { CodeCornerWidget, type FenceInfo } from "@/features/editor/widgets/code-corner";
import { alertTitles, alertType } from "@/lib/markdown/alerts";
import { mathFence } from "@/lib/markdown/math";
import { type DecorationBuilder, lineRange, touches } from "./live-preview-builder";

/**
 * The live preview of the constructs that draw across lines: code and math fences, list items,
 * quotes and the alerts written at the top of one.
 */

class BulletWidget extends WidgetType {
  override eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const bullet = document.createElement("span");
    bullet.className = "md-list-bullet";
    return bullet;
  }
}

/**
 * The number an ordered item shows: its place in the list, not the number written in its source,
 * which stops matching as soon as an item before it is added or removed.
 */
class OrderedMarkWidget extends WidgetType {
  constructor(readonly number: number) {
    super();
  }

  override eq(other: OrderedMarkWidget): boolean {
    return other.number === this.number;
  }

  toDOM(): HTMLElement {
    const mark = document.createElement("span");
    mark.className = "md-list-mark";
    mark.textContent = `${this.number}. `;
    return mark;
  }
}

/** How many ordered items come before this one in its own list, from zero. */
function itemIndex(node: SyntaxNode): number {
  let before = 0;
  for (let sibling = node.prevSibling; sibling; sibling = sibling.prevSibling) {
    if (sibling.name === "ListItem") before++;
  }
  return before;
}

/** A task's checkbox; clicking it edits the `[ ]` or `[x]` it stands for. */
class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }

  override eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked;
  }

  toDOM(view: EditorView): HTMLElement {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "md-task-checkbox";
    checkbox.checked = this.checked;
    checkbox.addEventListener("mousedown", (event) => {
      event.preventDefault();
      // The widget replaces "[ ]", so the character after its start is the check mark
      const pos = view.posAtDOM(checkbox) + 1;
      view.dispatch({ changes: { from: pos, to: pos + 1, insert: this.checked ? " " : "x" } });
    });
    return checkbox;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}
const bullet = Decoration.replace({ widget: new BulletWidget() });
function ancestorCount(node: SyntaxNode, name: string): number {
  let count = 0;
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.name === name) count++;
  }
  return count;
}
function fenceInfo(
  builder: DecorationBuilder,
  node: SyntaxNode,
  active: boolean,
): FenceInfo | undefined {
  const mark = node.name === "FencedCode" ? node.getChild("CodeMark") : null;
  if (!mark || active) return undefined;
  const line = builder.lineAt(mark.from);
  const tail = builder.text(mark.to, line.to);
  const word = /\S+/.exec(tail);
  const from = mark.to + (word?.index ?? 0);
  return {
    language: word?.[0] ?? "",
    from,
    to: from + (word?.[0].length ?? 0),
    tailFrom: mark.to,
    tailTo: line.to,
  };
}

/** Whether the block opens a rendering over its source when the selection touches it. */
export function showsRendering(state: EditorState, node: SyntaxNode): boolean {
  if (node.name === "BlockMath") return true;
  if (node.name !== "FencedCode") return false;
  if (mathFence(state, node) !== undefined) return true;
  const info = node.getChild("CodeInfo");
  return info !== null && state.sliceDoc(info.from, info.to).trim().toLowerCase() === "mermaid";
}

export function visitCodeBlock(builder: DecorationBuilder, node: SyntaxNode): void {
  const first = builder.lineAt(node.from).number;
  const last = builder.lineAt(node.to).number;
  const active = touches(builder.ranges, ...lineRange(builder.state, node));
  const rendering = active && showsRendering(builder.state, node);
  builder.eachLine(node.from, node.to, (line, number) => {
    line.classes.add("md-code-block");
    if (number === first) {
      line.classes.add("md-code-block-start");
      // The line holding the rendering takes it over its own padding and line box (editor.css)
      if (rendering) line.classes.add("md-code-render");
    }
    if (number === last) line.classes.add("md-code-block-end");
  });
  const info = node.getChild("CodeInfo");
  // The corner stands at the end of the opening line: the fence names the language, and the same
  // line carries the button that copies the block, so the source starts right under it. A closed
  // block keeps it at the start of the line the rendering takes over.
  const widget = new CodeCornerWidget(fenceInfo(builder, node, active), rendering);
  const corner = rendering ? builder.lineAt(node.from).to : node.from;
  builder.decorations.push(Decoration.widget({ widget, side: -1 }).range(corner));
  if (node.name === "CodeBlock") return;

  for (const fence of node.getChildren(node.name === "BlockMath" ? "MathMark" : "CodeMark")) {
    builder.marker(fence, active);
    if (!active) builder.lineClass(fence.from, fence.from, "md-syntax-line");
  }
  if (info) builder.marker(info, active);
}

export function visitListItem(builder: DecorationBuilder, node: SyntaxNode): void {
  const mark = node.getChild("ListMark");
  if (!mark) return;
  const depth = ancestorCount(node, "ListItem") + 1;
  const firstLine = builder.lineAt(node.from);
  const markLine = builder.lineAt(mark.from);
  // Continuation lines are indented up to the item's content; that indentation becomes padding
  const contentColumn = mark.to - markLine.from + builder.spaceAfter(mark.to);
  builder.eachLine(node.from, node.to, (line, number) => {
    const isFirst = number === firstLine.number;
    line.listDepth = depth;
    // The marker of the first line hangs into the indentation; the others only take the depth
    if (isFirst) line.classes.add("md-list-item");
    else line.classes.delete("md-list-item");
    line.listIndent = isFirst ? mark.from - markLine.from : contentColumn;
  });

  const active = touches(builder.ranges, markLine.from, markLine.to);
  const task = mark.nextSibling?.name === "Task" ? mark.nextSibling.getChild("TaskMarker") : null;
  const marker = mark.to + builder.spaceAfter(mark.to);
  if (task && !active) {
    // A task reads as its checkbox alone, like on GitHub
    const checked = /x/i.test(builder.text(task.from, task.to));
    builder.hide(mark.from, task.from);
    builder.decorations.push(
      Decoration.replace({ widget: new CheckboxWidget(checked) }).range(task.from, task.to),
    );
    builder.lineClass(
      markLine.from,
      markLine.from,
      checked ? "md-task md-task-checked" : "md-task",
    );
  } else if (node.parent?.name === "OrderedList" && !task) {
    // An ordered item counts from its place in the list, so removing an item above renumbers the
    // rest; the number written in the source is not shown, since it is only what the item was
    // written as and would sit stale beside the others. The editor writes the count back into
    // the source after an edit (renumber-lists.ts), so the file keeps the numbers it shows.
    builder.decorations.push(
      Decoration.replace({ widget: new OrderedMarkWidget(itemIndex(node) + 1) }).range(
        mark.from,
        marker,
      ),
    );
  } else if (node.parent?.name === "BulletList" && !active && !task) {
    builder.decorations.push(bullet.range(mark.from, marker));
  } else {
    builder.mark(mark.from, marker, "md-list-mark");
  }
}
/** A quote opening with `[!NOTE]` and the like is tinted, and titled away from the selection. */
function visitAlert(builder: DecorationBuilder, quote: SyntaxNode): void {
  const paragraph = quote.getChild("Paragraph");
  if (!paragraph || builder.lineAt(paragraph.from).from !== builder.lineAt(quote.from).from) return;
  const line = builder.lineAt(paragraph.from);
  const type = alertType(builder.text(paragraph.from, line.to));
  const titles = builder.state.facet(alertTitles);
  if (!type || !titles) return;
  builder.alertMarkers.add(paragraph.from);
  builder.eachLine(quote.from, quote.to, (style) => {
    style.classes.add("md-alert");
    style.attributes["data-alert"] = type;
  });
  if (touches(builder.ranges, line.from, line.to)) {
    builder.mark(paragraph.from, line.to, "md-mark");
  } else {
    const widget = new AlertTitleWidget(titles[type]);
    builder.decorations.push(Decoration.replace({ widget }).range(paragraph.from, line.to));
  }
}
/** Tints a quote and, when it opens with an alert marker, titles it. */
export function visitBlockquote(builder: DecorationBuilder, node: SyntaxNode): void {
  const depth = ancestorCount(node, "Blockquote") + 1;
  builder.eachLine(node.from, node.to, (line) => {
    line.classes.add("md-quote");
    line.quoteDepth = depth;
  });
  visitAlert(builder, node);
}
