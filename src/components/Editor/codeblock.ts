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
import { create as createOndine } from "ondine/compiler/wasm";
import { wasm as ondineAllWasm } from "ondine/compiler/wasm/all";
import { t } from "@/i18n";

let ondineRenderer: ReturnType<typeof createOndine> | null = null;
function getOndineRenderer() {
  if (!ondineRenderer) {
    ondineRenderer = createOndine({
      modules: {
        all: ondineAllWasm,
      },
    });
  }
  return ondineRenderer;
}

/**
 * Header Widget for fenced code blocks (Language badge & Copy button)
 */
class CodeBlockHeaderWidget extends WidgetType {
  constructor(
    readonly lang: string,
    readonly code: string,
  ) {
    super();
  }

  override eq(other: CodeBlockHeaderWidget): boolean {
    return this.lang === other.lang && this.code === other.code;
  }

  override toDOM(): HTMLElement {
    const header = document.createElement("div");
    header.dir = "ltr";
    header.className = "cm-codeblock-header select-none";

    if (this.lang) {
      const badge = document.createElement("span");
      badge.className = "cm-codeblock-lang";
      badge.textContent = this.lang;
      header.appendChild(badge);
    }

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "cm-codeblock-copy-btn";
    copyBtn.textContent = t().common.copy;
    copyBtn.title = t().common.copy;
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      void navigator.clipboard.writeText(this.code).then(() => {
        copyBtn.textContent = t().common.copied;
        copyBtn.classList.add("copied");
        setTimeout(() => {
          copyBtn.textContent = t().common.copy;
          copyBtn.classList.remove("copied");
        }, 1800);
      });
    });

    header.appendChild(copyBtn);
    return header;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Mermaid diagram preview widget
 */
class MermaidPreviewWidget extends WidgetType {
  constructor(readonly code: string) {
    super();
  }

  override eq(other: MermaidPreviewWidget): boolean {
    return this.code === other.code;
  }

  override toDOM(): HTMLElement {
    const container = document.createElement("div");
    container.dir = "ltr";
    container.className =
      "ondine-diagram my-3 flex justify-center p-4 rounded-lg bg-surface-0 border border-border overflow-x-auto shadow-sm select-none";
    try {
      const ondine = getOndineRenderer();
      const res = ondine.render(this.code);
      container.innerHTML = res.svg;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      container.className =
        "p-3 my-2 text-xs rounded-md bg-destructive/10 border border-destructive/20 text-destructive font-mono";
      container.textContent = `Mermaid syntax error: ${msg}`;
    }
    return container;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

import { rangeIntersectsSelection } from "./syntaxUtils";

/**
 * Native CodeMirror 6 Code Block Plugin
 * - Seamless line background & border styling across the entire code block
 * - Persistent syntax highlighting regardless of cursor position (no jump / flash)
 * - Header with language indicator and copy button
 * - Built-in Mermaid diagram live preview
 */
export const codeBlockNativePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const state = view.state;
      const selectionRanges = state.selection.ranges;
      const decos: Range<Decoration>[] = [];
      const lineMap = new Map<number, { classes: Set<string>; indentLength: number }>();

      const addLine = (lineFrom: number, className: string, indentLength: number) => {
        let entry = lineMap.get(lineFrom);
        if (!entry) {
          entry = { classes: new Set(), indentLength };
          lineMap.set(lineFrom, entry);
        }
        entry.classes.add(className);
      };

      const ranges =
        view.visibleRanges.length > 0 && (view.visibleRanges[0]?.to ?? 0) > 0
          ? view.visibleRanges
          : [{ from: 0, to: Math.min(state.doc.length, 20000) }];

      for (const { from, to } of ranges) {
        syntaxTree(state).iterate({
          from,
          to,
          enter: (node) => {
            if (node.name === "FencedCode") {
              const startLine = state.doc.lineAt(node.from);
              const endLine = state.doc.lineAt(node.to);

              const firstLineText = startLine.text;
              const indentMatch = firstLineText.match(/^([ \t]*)/);
              const leadingIndent = indentMatch ? (indentMatch[1] ?? "") : "";
              const indentLength = leadingIndent.length;

              for (let l = startLine.number; l <= endLine.number; l++) {
                const curLine = state.doc.line(l);
                let cls = "cm-codeblock-line";
                if (l === startLine.number) cls += " cm-codeblock-first";
                if (l === endLine.number) cls += " cm-codeblock-last";
                addLine(curLine.from, cls, indentLength);

                // If nested in a list or quote with indent, collapse the leading indent on each line
                // so the code text is neatly aligned inside the indented card without double indentation
                if (indentLength > 0 && curLine.text.startsWith(leadingIndent)) {
                  decos.push(
                    Decoration.mark({ class: "cm-codeblock-indent-hidden" }).range(
                      curLine.from,
                      curLine.from + indentLength,
                    ),
                  );
                }
              }

              const rawBlock = state.sliceDoc(node.from, node.to);
              const langMatch = firstLineText.trimStart().match(/^```\s*(\S+)/);
              const lang = langMatch ? (langMatch[1] ?? "") : "";

              const firstNewline = rawBlock.indexOf("\n");
              const codeBody =
                firstNewline !== -1
                  ? rawBlock.slice(firstNewline + 1).replace(/\r?\n[ \t]*```$/, "")
                  : "";

              decos.push(
                Decoration.widget({
                  widget: new CodeBlockHeaderWidget(lang, codeBody),
                  side: 1,
                }).range(startLine.to),
              );

              if (lang.toLowerCase() === "mermaid") {
                const isSelected = rangeIntersectsSelection(node.from, node.to, selectionRanges);
                if (!isSelected && codeBody.trim()) {
                  decos.push(
                    Decoration.widget({
                      widget: new MermaidPreviewWidget(codeBody),
                      side: 1,
                    }).range(endLine.to),
                  );
                }
              }
            }
          },
        });
      }

      for (const [lineFrom, { classes, indentLength }] of lineMap) {
        const spec: { class: string; attributes?: { [key: string]: string } } = {
          class: Array.from(classes).join(" "),
          attributes: {
            dir: "ltr",
            style: `direction: ltr !important; text-align: left !important; unicode-bidi: isolate !important;${
              indentLength > 0 ? ` --codeblock-indent: ${indentLength}ch;` : ""
            }`,
          },
        };
        decos.push(Decoration.line(spec).range(lineFrom));
      }

      decos.sort((a, b) => a.from - b.from || (a.value.startSide ?? 0) - (b.value.startSide ?? 0));
      return RangeSet.of(decos, true);
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);
