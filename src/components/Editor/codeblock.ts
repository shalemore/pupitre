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
 * Dedicated Mermaid Full Card Widget (Shown when cursor is outside the code block)
 * Hides raw markdown code and renders a spacious, elegant diagram card with Edit & Copy actions.
 */
class MermaidBlockWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly blockPos: number,
  ) {
    super();
  }

  override eq(other: MermaidBlockWidget): boolean {
    return this.code === other.code && this.blockPos === other.blockPos;
  }

  override toDOM(view: EditorView): HTMLElement {
    const card = document.createElement("div");
    card.dir = "ltr";
    card.className =
      "cm-mermaid-card my-4 rounded-xl border border-border/80 bg-surface-0 shadow-sm overflow-hidden select-none transition-all hover:border-brand/40 hover:shadow-md";

    const header = document.createElement("div");
    header.className =
      "flex items-center justify-between px-4 py-2 border-b border-border/60 bg-surface-1/70 text-xs";

    const titleBadge = document.createElement("span");
    titleBadge.className =
      "font-mono font-semibold text-[11px] text-muted-foreground tracking-wider uppercase";
    titleBadge.textContent = "MERMAID DIAGRAM";
    header.appendChild(titleBadge);

    const btnGroup = document.createElement("div");
    btnGroup.className = "flex items-center gap-2";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className =
      "px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer font-medium";
    editBtn.textContent = t().editor.editCode;
    editBtn.title = t().editor.clickToEdit;
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      view.dispatch({
        selection: { anchor: this.blockPos + 3 },
      });
      view.focus();
    });
    btnGroup.appendChild(editBtn);

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className =
      "px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer font-medium";
    copyBtn.textContent = t().common.copy;
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      void navigator.clipboard.writeText(this.code).then(() => {
        copyBtn.textContent = t().common.copied;
        setTimeout(() => {
          copyBtn.textContent = t().common.copy;
        }, 1500);
      });
    });
    btnGroup.appendChild(copyBtn);

    header.appendChild(btnGroup);
    card.appendChild(header);

    const body = document.createElement("div");
    body.className =
      "p-6 flex justify-center items-center overflow-x-auto min-h-[100px] cursor-pointer";
    body.title = t().editor.dblClickToEdit;
    body.addEventListener("dblclick", () => {
      view.dispatch({
        selection: { anchor: this.blockPos + 3 },
      });
      view.focus();
    });

    try {
      const ondine = getOndineRenderer();
      const res = ondine.render(this.code);
      body.innerHTML = res.svg;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      body.className =
        "p-4 text-xs bg-destructive/10 border-t border-destructive/20 text-destructive font-mono";
      body.textContent = `Mermaid syntax error: ${msg}`;
    }

    card.appendChild(body);
    return card;
  }
}

/**
 * Mermaid diagram preview widget (Shown when cursor is actively inside the code block)
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
      "ondine-diagram mt-3 mb-2 flex flex-col p-4 rounded-xl border border-dashed border-border/80 bg-surface-0/60 overflow-x-auto shadow-sm select-none";

    const title = document.createElement("div");
    title.className =
      "text-[10px] font-mono uppercase text-muted-foreground mb-3 flex items-center gap-1.5";
    title.innerHTML = `<span class="size-1.5 rounded-full bg-brand inline-block"></span> ${t().editor.livePreview}`;
    container.appendChild(title);

    const body = document.createElement("div");
    body.className = "flex justify-center overflow-x-auto";
    try {
      const ondine = getOndineRenderer();
      const res = ondine.render(this.code);
      body.innerHTML = res.svg;
    } catch {
      body.className = "text-[11px] text-muted-foreground italic text-center py-2";
      body.textContent = t().editor.waitingDiagramSyntax;
    }

    container.appendChild(body);
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
              const langMatch = firstLineText.trimStart().match(/^```\s*(\S+)/);
              const lang = langMatch ? (langMatch[1] ?? "") : "";

              const rawBlock = state.sliceDoc(node.from, node.to);
              const firstNewline = rawBlock.indexOf("\n");
              const codeBody =
                firstNewline !== -1
                  ? rawBlock.slice(firstNewline + 1).replace(/\r?\n[ \t]*```$/, "")
                  : "";

              const isMermaid = lang.toLowerCase() === "mermaid";
              const isSelected = rangeIntersectsSelection(node.from, node.to, selectionRanges);

              // If Mermaid and NOT actively focused/selected: replace entire block with clean diagram card
              if (isMermaid && !isSelected && codeBody.trim()) {
                decos.push(
                  Decoration.replace({
                    widget: new MermaidBlockWidget(codeBody, startLine.from),
                    block: true,
                  }).range(startLine.from, endLine.to),
                );
                return;
              }

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

              decos.push(
                Decoration.widget({
                  widget: new CodeBlockHeaderWidget(lang, codeBody),
                  side: 1,
                }).range(startLine.to),
              );

              // When editing Mermaid: show active live preview below the code block
              if (isMermaid && isSelected && codeBody.trim()) {
                decos.push(
                  Decoration.widget({
                    widget: new MermaidPreviewWidget(codeBody),
                    side: 1,
                  }).range(endLine.to),
                );
              }
            }
          },
        });
      }

      for (const [lineFrom, { classes, indentLength }] of lineMap) {
        const attributes: { [key: string]: string } = { dir: "ltr" };
        if (indentLength > 0) {
          attributes["style"] = `--codeblock-indent: ${indentLength}ch;`;
        }
        const spec = {
          class: Array.from(classes).join(" "),
          attributes,
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
