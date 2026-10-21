import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  insertNewlineAndIndent,
} from "@codemirror/commands";
import {
  deleteMarkupBackward,
  insertNewlineContinueMarkup,
  markdown,
} from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import {
  findNext,
  findPrevious,
  highlightSelectionMatches,
  replaceAll,
  replaceNext,
  search,
  SearchQuery,
  setSearchQuery,
} from "@codemirror/search";
import { Annotation, Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import {
  collapseOnSelectionFacet,
  imageField,
  linkPlugin,
  mouseSelectingField,
  tableEditorField,
  tableEditorPlugin,
  tableField,
} from "codemirror-live-markdown";
import { createEffect, onCleanup, onMount, type Component } from "solid-js";
import { codeBlockNativePlugin } from "./codeblock";
import { unifiedLivePreviewPlugin } from "./livePreview";
import { getThemeExtension } from "./theme";
import { resolveEditorFontFamily } from "@/lib/fonts";

const externalChangeAnnotation = Annotation.define<boolean>();

export interface SearchOptions {
  search: string;
  replace?: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regexp?: boolean;
}

export interface MatchStats {
  current: number;
  total: number;
}

export interface EditorHandle {
  scrollToPos: (pos: number) => void;
  focus: () => void;
  setSearchQuery: (options: SearchOptions) => MatchStats;
  findNext: () => MatchStats;
  findPrevious: () => MatchStats;
  replaceNext: () => MatchStats;
  replaceAll: () => MatchStats;
  getSelectionText: () => string;
}

export interface EditorProps {
  content: string;
  isDark?: boolean;
  fontSize?: number;
  lineHeight?: number;
  fontFamily?: string;
  fallbackFont?: string | undefined;
  tabSize?: number;
  wordWrap?: boolean;
  editorWidth?: string;
  zoom?: number;
  blockSpacing?: boolean;
  onChange: (newContent: string) => void;
  onCursorChange?: (pos: number, lineNumber: number) => void;
  ref?: (handle: EditorHandle) => void;
}

function computeMatchStats(view: EditorView, query: SearchQuery): MatchStats {
  if (!query.search || !query.valid) return { current: 0, total: 0 };
  const cursor = query.getCursor(view.state.doc);
  let total = 0;
  let current = 0;
  const selFrom = view.state.selection.main.from;
  const selTo = view.state.selection.main.to;

  let item = cursor.next();
  while (!item.done) {
    total++;
    if (item.value.from === selFrom && item.value.to === selTo) {
      current = total;
    }
    item = cursor.next();
  }
  return { current, total };
}

function isInsideCodeOrTable(node: SyntaxNode | null): boolean {
  let cur: SyntaxNode | null = node;
  while (cur) {
    if (
      cur.name === "FencedCode" ||
      cur.name === "CodeBlock" ||
      cur.name === "Table" ||
      cur.name === "TableRow" ||
      cur.name === "TableCell"
    ) {
      return true;
    }
    cur = cur.parent;
  }
  return false;
}

function createBlockSpacingKeymap(isBlockSpacingEnabled: () => boolean) {
  return keymap.of([
    {
      key: "Enter",
      run: (view) => {
        // 1. Prioritize markdown list item continuation (- [ ] item, 1. item, etc.)
        if (insertNewlineContinueMarkup(view)) {
          return true;
        }

        if (!isBlockSpacingEnabled()) {
          return false;
        }

        const { state } = view;
        if (!state.selection.main.empty) {
          return false;
        }

        const pos = state.selection.main.head;
        const tree = syntaxTree(state);
        const node = tree.resolveInner(pos, -1);

        if (isInsideCodeOrTable(node)) {
          return false;
        }

        const curLine = state.doc.lineAt(pos);

        // If line is empty or whitespace-only, insert standard single newline
        if (curLine.text.trim().length === 0) {
          return false;
        }

        // If cursor is at the end of the line
        if (pos === curLine.to) {
          // If the next line already exists and is empty, advance cursor into it
          if (curLine.number < state.doc.lines) {
            const nextLine = state.doc.line(curLine.number + 1);
            if (nextLine.text.trim().length === 0) {
              view.dispatch({
                selection: { anchor: nextLine.from },
                scrollIntoView: true,
              });
              return true;
            }
          }
          // Otherwise, insert \n\n to cleanly start a new block separated by an empty line
          view.dispatch({
            changes: { from: pos, to: pos, insert: "\n\n" },
            selection: { anchor: pos + 2 },
            scrollIntoView: true,
          });
          return true;
        }

        // If cursor is in the middle of a line, split paragraphs with an empty line
        view.dispatch({
          changes: { from: pos, to: pos, insert: "\n\n" },
          selection: { anchor: pos + 2 },
          scrollIntoView: true,
        });
        return true;
      },
    },
    {
      key: "Shift-Enter",
      run: insertNewlineAndIndent,
    },
    {
      key: "Backspace",
      run: deleteMarkupBackward,
    },
    {
      key: "ArrowDown",
      run: (view) => {
        if (!isBlockSpacingEnabled()) return false;
        const { state } = view;
        if (!state.selection.main.empty) return false;

        const pos = state.selection.main.head;
        const curLine = state.doc.lineAt(pos);

        // If current line has content, and the next line is an empty separator line, jump over it
        if (curLine.text.trim().length > 0 && curLine.number + 1 < state.doc.lines) {
          const nextLine = state.doc.line(curLine.number + 1);
          if (nextLine.text.trim().length === 0) {
            const targetLine = state.doc.line(curLine.number + 2);
            const col = pos - curLine.from;
            const targetPos = targetLine.from + Math.min(col, targetLine.length);
            view.dispatch({
              selection: { anchor: targetPos },
              scrollIntoView: true,
            });
            return true;
          }
        }
        return false;
      },
    },
    {
      key: "ArrowUp",
      run: (view) => {
        if (!isBlockSpacingEnabled()) return false;
        const { state } = view;
        if (!state.selection.main.empty) return false;

        const pos = state.selection.main.head;
        const curLine = state.doc.lineAt(pos);

        // If current line has content, and previous line is an empty separator line, jump over it
        if (curLine.text.trim().length > 0 && curLine.number > 2) {
          const prevLine = state.doc.line(curLine.number - 1);
          if (prevLine.text.trim().length === 0) {
            const targetLine = state.doc.line(curLine.number - 2);
            const col = pos - curLine.from;
            const targetPos = targetLine.from + Math.min(col, targetLine.length);
            view.dispatch({
              selection: { anchor: targetPos },
              scrollIntoView: true,
            });
            return true;
          }
        }
        return false;
      },
    },
  ]);
}

export const Editor: Component<EditorProps> = (props) => {
  let containerRef: HTMLDivElement | null = null;
  let view: EditorView | null = null;
  let currentQuery: SearchQuery | null = null;

  const wrapCompartment = new Compartment();
  const tabCompartment = new Compartment();

  onMount(() => {
    if (!containerRef) return;

    const startState = EditorState.create({
      doc: props.content,
      extensions: [
        createBlockSpacingKeymap(() => props.blockSpacing !== false),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        history(),
        wrapCompartment.of(props.wordWrap !== false ? EditorView.lineWrapping : []),
        tabCompartment.of(EditorState.tabSize.of(props.tabSize ?? 2)),

        // Suppress CodeMirror's built-in panel to allow our custom find/replace bar
        search({ top: false }),
        highlightSelectionMatches({ minSelectionLength: 2 }),

        markdown({
          codeLanguages: languages,
          extensions: [GFM],
        }),

        codeBlockNativePlugin,

        collapseOnSelectionFacet.of(true),
        mouseSelectingField,
        unifiedLivePreviewPlugin,
        linkPlugin(),
        tableField,
        tableEditorField,
        tableEditorPlugin(),
        imageField(),

        getThemeExtension(),

        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const isExternal = update.transactions.some((tr) =>
              tr.annotation(externalChangeAnnotation),
            );
            if (!isExternal) {
              props.onChange(update.state.doc.toString());
            }
          }

          if (update.selectionSet || update.docChanged) {
            const pos = update.state.selection.main.head;
            const line = update.state.doc.lineAt(pos).number;
            props.onCursorChange?.(pos, line);
          }
        }),
      ],
    });

    view = new EditorView({
      state: startState,
      parent: containerRef,
    });

    if (props.ref) {
      props.ref({
        scrollToPos: (pos: number) => {
          if (!view) return;
          const safePos = Math.max(0, Math.min(pos, view.state.doc.length));
          view.dispatch({
            selection: { anchor: safePos },
            effects: EditorView.scrollIntoView(safePos, { y: "start", yMargin: 40 }),
          });
          view.focus();
        },
        focus: () => {
          view?.focus();
        },
        setSearchQuery: (options: SearchOptions): MatchStats => {
          if (!view) return { current: 0, total: 0 };
          try {
            currentQuery = new SearchQuery({
              search: options.search,
              replace: options.replace ?? "",
              caseSensitive: options.caseSensitive ?? false,
              wholeWord: options.wholeWord ?? false,
              regexp: options.regexp ?? false,
            });
            view.dispatch({
              effects: setSearchQuery.of(currentQuery),
            });
            return computeMatchStats(view, currentQuery);
          } catch {
            return { current: 0, total: 0 };
          }
        },
        findNext: (): MatchStats => {
          if (!view) return { current: 0, total: 0 };
          findNext(view);
          return currentQuery ? computeMatchStats(view, currentQuery) : { current: 0, total: 0 };
        },
        findPrevious: (): MatchStats => {
          if (!view) return { current: 0, total: 0 };
          findPrevious(view);
          return currentQuery ? computeMatchStats(view, currentQuery) : { current: 0, total: 0 };
        },
        replaceNext: (): MatchStats => {
          if (!view) return { current: 0, total: 0 };
          replaceNext(view);
          return currentQuery ? computeMatchStats(view, currentQuery) : { current: 0, total: 0 };
        },
        replaceAll: (): MatchStats => {
          if (!view) return { current: 0, total: 0 };
          replaceAll(view);
          return currentQuery ? computeMatchStats(view, currentQuery) : { current: 0, total: 0 };
        },
        getSelectionText: (): string => {
          if (!view) return "";
          const sel = view.state.selection.main;
          return view.state.sliceDoc(sel.from, sel.to);
        },
      });
    }
  });

  // Keep content in sync with external changes (without falsely triggering dirty state)
  createEffect(() => {
    const nextContent = props.content;
    if (!view) return;
    const current = view.state.doc.toString();
    if (nextContent !== current) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: nextContent },
        annotations: [externalChangeAnnotation.of(true)],
      });
    }
  });

  createEffect(() => {
    const wrap = props.wordWrap !== false;
    if (!view) return;
    view.dispatch({
      effects: wrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : []),
    });
  });

  createEffect(() => {
    const size = props.tabSize ?? 2;
    if (!view) return;
    view.dispatch({
      effects: tabCompartment.reconfigure(EditorState.tabSize.of(size)),
    });
  });

  createEffect(() => {
    if (!containerRef) return;
    const fs = props.fontSize ?? 15;
    const lh = props.lineHeight ?? 1.75;
    const zoom = props.zoom ?? 1.0;
    const ff = resolveEditorFontFamily(props.fontFamily ?? "sans", props.fallbackFont);
    const mw =
      props.editorWidth === "compact"
        ? "720px"
        : props.editorWidth === "wide"
          ? "1040px"
          : props.editorWidth === "full"
            ? "100%"
            : "880px";

    // Crisp native font sizing scaled with zoom (avoiding blurry CSS transforms)
    containerRef.style.setProperty("--editor-font-size", `${fs * zoom}px`);
    containerRef.style.setProperty("--editor-line-height", `${lh}`);
    containerRef.style.setProperty("--editor-font-family", ff);
    containerRef.style.setProperty("--editor-max-width", mw);
    containerRef.style.setProperty("--editor-zoom", `${zoom}`);
  });

  onCleanup(() => {
    view?.destroy();
    view = null;
  });

  return (
    <div
      ref={(el) => {
        containerRef = el;
      }}
      class="overflow-hidden focus:outline-none size-full relative"
    />
  );
};
