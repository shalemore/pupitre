import { syntaxTree } from "@codemirror/language";
import { RangeSet, type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { SyntaxNodeRef } from "@lezer/common";
import { rangeIntersectsSelection } from "./syntaxUtils";

class BulletWidget extends WidgetType {
  override eq(): boolean {
    return true;
  }
  override toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-bullet-mark";
    span.textContent = "•";
    return span;
  }
  override ignoreEvent(): boolean {
    return true;
  }
}

class TaskCheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly fromPos: number,
  ) {
    super();
  }

  override eq(other: TaskCheckboxWidget): boolean {
    return this.checked === other.checked && this.fromPos === other.fromPos;
  }

  override toDOM(view: EditorView): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-task-widget";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.checked;
    input.className = "cm-task-checkbox";
    input.addEventListener("change", (e) => {
      e.stopPropagation();
      const newChar = this.checked ? " " : "x";
      view.dispatch({
        changes: { from: this.fromPos + 1, to: this.fromPos + 2, insert: newChar },
      });
    });

    span.appendChild(input);
    return span;
  }

  override ignoreEvent(event: Event): boolean {
    return event.type === "mousedown" || event.type === "click" || event.type === "change";
  }
}

class HorizontalRuleWidget extends WidgetType {
  override eq(): boolean {
    return true;
  }
  override toDOM(): HTMLElement {
    const hr = document.createElement("hr");
    hr.className = "cm-hr-widget";
    return hr;
  }
  override ignoreEvent(): boolean {
    return true;
  }
}

const INLINE_CONTAINER_NODES = new Set([
  "StrongEmphasis",
  "Emphasis",
  "Strikethrough",
  "InlineCode",
]);

const BLOCK_MARK_NODES = new Set(["HeaderMark", "QuoteMark"]);

const SKIP_PARENT_TYPES = new Set(["FencedCode", "CodeBlock"]);

function isInsideSkippedParent(node: SyntaxNodeRef): boolean {
  let parent = node.node.parent;
  while (parent) {
    if (SKIP_PARENT_TYPES.has(parent.name)) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

const CONTAINER_STYLE_MAP: Record<string, string> = {
  ATXHeading1: "cm-header-1 cm-heading-1",
  ATXHeading2: "cm-header-2 cm-heading-2",
  ATXHeading3: "cm-header-3 cm-heading-3",
  ATXHeading4: "cm-header-4 cm-heading-4",
  ATXHeading5: "cm-header-5 cm-heading-5",
  ATXHeading6: "cm-header-6 cm-heading-6",
  SetextHeading1: "cm-header-1 cm-heading-1",
  SetextHeading2: "cm-header-2 cm-heading-2",
  StrongEmphasis: "cm-strong",
  Emphasis: "cm-emphasis",
  Strikethrough: "cm-strikethrough",
  InlineCode: "cm-code cm-inline-code",
  Link: "cm-link",
};

/**
 * Unified Live Preview plugin for Markdown inline and block formatting marks.
 * Fixes asymmetric mark display: both prefix and suffix marks expand and collapse
 * together whenever the cursor or selection touches any part of the formatted span.
 */
export const unifiedLivePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = this.build(update.view);
      }
    }

    build(view: EditorView): DecorationSet {
      const { state } = view;
      const decos: Range<Decoration>[] = [];
      const ranges = state.selection.ranges;

      const activeLines = new Set<number>();
      for (const r of ranges) {
        const startL = state.doc.lineAt(r.from).number;
        const endL = state.doc.lineAt(r.to).number;
        for (let l = startL; l <= endL; l++) {
          activeLines.add(l);
        }
      }

      const decoratedMarks = new Set<string>();

      syntaxTree(state).iterate({
        enter: (node) => {
          if (isInsideSkippedParent(node)) {
            return;
          }

          const containerCls = CONTAINER_STYLE_MAP[node.name];
          if (containerCls) {
            decos.push(Decoration.mark({ class: containerCls }).range(node.from, node.to));
            if (node.name.startsWith("ATXHeading") || node.name.startsWith("SetextHeading")) {
              const levelMatch = node.name.match(/\d$/);
              const level = levelMatch ? levelMatch[0] : "1";
              const startLine = state.doc.lineAt(node.from);
              const endLine = state.doc.lineAt(node.to);
              for (let l = startLine.number; l <= endLine.number; l++) {
                const line = state.doc.line(l);
                decos.push(
                  Decoration.line({
                    class: `cm-heading-line cm-heading-line-${level}`,
                  }).range(line.from),
                );
              }
            }
          }

          if (INLINE_CONTAINER_NODES.has(node.name)) {
            const isSpanTouched = rangeIntersectsSelection(node.from, node.to, ranges);
            const markClass = isSpanTouched
              ? "cm-formatting-inline cm-formatting-inline-visible"
              : "cm-formatting-inline";

            let child = node.node.firstChild;
            while (child) {
              if (
                child.name === "EmphasisMark" ||
                child.name === "StrikethroughMark" ||
                child.name === "CodeMark"
              ) {
                const key = `${child.from}:${child.to}`;
                if (!decoratedMarks.has(key)) {
                  decoratedMarks.add(key);
                  decos.push(Decoration.mark({ class: markClass }).range(child.from, child.to));
                }
              }
              child = child.nextSibling;
            }
            return;
          }

          if (BLOCK_MARK_NODES.has(node.name)) {
            let markTo = node.to;
            if (node.name === "HeaderMark" || node.name === "QuoteMark") {
              const lineText = state.doc.lineAt(node.from).text;
              const offsetInLine = node.to - state.doc.lineAt(node.from).from;
              const spaceMatch = lineText.slice(offsetInLine).match(/^[ \t]+/);
              if (spaceMatch) {
                markTo = node.to + spaceMatch[0].length;
              }
            }

            const key = `${node.from}:${markTo}`;
            if (!decoratedMarks.has(key)) {
              decoratedMarks.add(key);
              const lineNum = state.doc.lineAt(node.from).number;
              const isLineActive = activeLines.has(lineNum);
              const markClass = isLineActive
                ? "cm-formatting-block cm-formatting-block-visible"
                : "cm-formatting-block";
              decos.push(Decoration.mark({ class: markClass }).range(node.from, markTo));
            }
            return;
          }

          if (node.name === "ListMark") {
            const lineNum = state.doc.lineAt(node.from).number;
            const isLineActive = activeLines.has(lineNum);
            const markText = state.sliceDoc(node.from, node.to);
            if (!isLineActive && (markText === "-" || markText === "+" || markText === "*")) {
              const parent = node.node.parent;
              const hasTask = parent?.getChild("Task");
              if (!hasTask) {
                decos.push(
                  Decoration.replace({
                    widget: new BulletWidget(),
                  }).range(node.from, node.to),
                );
              }
            }
            return;
          }

          if (node.name === "TaskMarker") {
            const lineNum = state.doc.lineAt(node.from).number;
            const isLineActive = activeLines.has(lineNum);
            if (!isLineActive) {
              const raw = state.sliceDoc(node.from, node.to);
              const checked = raw.includes("x") || raw.includes("X");
              decos.push(
                Decoration.replace({
                  widget: new TaskCheckboxWidget(checked, node.from),
                }).range(node.from, node.to),
              );
            }
            return;
          }

          if (node.name === "HorizontalRule") {
            const lineNum = state.doc.lineAt(node.from).number;
            const isLineActive = activeLines.has(lineNum);
            if (!isLineActive) {
              decos.push(
                Decoration.replace({
                  widget: new HorizontalRuleWidget(),
                }).range(node.from, node.to),
              );
            }
            return;
          }
        },
      });

      decos.sort((a, b) => a.from - b.from || (a.value.startSide ?? 0) - (b.value.startSide ?? 0));
      return RangeSet.of(decos, true);
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);
