import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
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
