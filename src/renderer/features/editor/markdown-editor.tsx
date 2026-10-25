import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
} from "@codemirror/commands";
import { commonmarkLanguage, markdown } from "@codemirror/lang-markdown";
import { syntaxTree } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  replaceAll,
  replaceNext,
  search,
  SearchQuery,
  searchPanelOpen,
  setSearchQuery,
} from "@codemirror/search";
import { Compartment, EditorState, Prec } from "@codemirror/state";
import { type Command, EditorView, keymap, placeholder } from "@codemirror/view";
import { GFM, Subscript, Superscript } from "@lezer/markdown";
import { debounce } from "@solid-primitives/scheduled";
import { createEffect, on, onCleanup, onMount, type Component } from "solid-js";
import type { FormatAction } from "@shared/format";
import { ScrollView } from "@/components/ui";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { settings } from "@/lib/settings";
import { countText, type TextStats } from "@/lib/text-stats";
import { themeApplied } from "@/lib/theme";
import { alertTitles } from "./alerts";
import { codeHighlight } from "./code-highlight";
import { cursorStyle, restartCursorBlink } from "./cursor";
import {
  collectHeadings,
  documentObserver,
  findActiveHeading,
  type OutlineHeading,
  readableText,
} from "./document-structure";
import { emojiSyntax } from "./emoji";
import { footnotes } from "./footnotes";
import {
  formatKeymap,
  insertParagraphBreak,
  type MarkdownStyle,
  runFormatAction,
} from "./format-commands";
import { frontMatter } from "./front-matter";
import { highlight } from "./highlight";
import { createPendingImages, documentBaseUrl, imageInput } from "./images";
import { livePreview, setPrinting } from "./live-preview";
import { math, prerenderMath } from "./math";
import { diagramTheme, prerenderDiagrams, readDiagramTheme } from "./mermaid";
import { pasteHtml } from "./paste-html";
import { renderedBlocks } from "./rendered-blocks";
import { textDirection } from "./text-direction";
import { focusMode, typewriterMode } from "./writing-modes";

export interface SearchOptions {
  search: string;
  replace: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regexp: boolean;
}

export interface MatchStats {
  /** 1-based index of the selected match; 0 when no match is selected. */
  current: number;
  total: number;
}

export interface MarkdownEditorHandle {
  getMarkdown: () => string;
  focus: () => void;
  scrollTo: (pos: number) => void;
  getSelectedText: () => string;
  setSearch: (options: SearchOptions) => MatchStats;
  findNext: () => MatchStats;
  findPrevious: () => MatchStats;
  replaceNext: () => MatchStats;
  replaceAll: () => MatchStats;
  format: (action: FormatAction) => void;
  /**
   * Shows the whole document rendered and waits for fonts and diagrams, so a printout is complete;
   * the returned function goes back to editing.
   */
  prepareForPrint: () => Promise<() => void>;
  /** Writes images pasted before the document had a file next to it, see images.ts. */
  persistImages: (documentPath: string) => Promise<void>;
}

export interface MarkdownEditorProps {
  markdown: string;
  /** file:// URL of the document folder, to resolve relative image paths; undefined if unsaved. */
  baseUrl: string | undefined;
  /** Path of the document; pasted images are saved next to it. */
  documentPath: string | undefined;
  /** Called once the editor exists, with its content as the clean baseline. */
  onReady: (markdown: string) => void;
  onMarkdownChange: (markdown: string) => void;
  onOutlineChange: (headings: OutlineHeading[]) => void;
  onActiveHeadingChange: (index: number) => void;
  onStatsChange: (stats: TextStats) => void;
  ref: (handle: MarkdownEditorHandle) => void;
}

/** The syntax that formatting commands insert, as chosen in the settings. */
function markdownStyle(): MarkdownStyle {
  const {
    bulletMarker,
    emphasisMarker,
    strongMarker,
    fenceMarker,
    ruleMarker,
    incrementListMarker,
  } = settings();
  return {
    bulletMarker,
    emphasisMarker,
    strongMarker,
    fenceMarker,
    ruleMarker,
    incrementListMarker,
  };
}

/**
 * CodeMirror injects its base styles outside every cascade layer, where they would beat the editor
 * layer, the theme and the preferences alike. `revert-layer` hands these properties back to the
 * layers (app.css), so the document is styled by CSS like the rest of the app.
 */
const layeredStyles = EditorView.theme({
  "&.cm-focused": { outline: "revert-layer" },
  ".cm-scroller": {
    fontFamily: "revert-layer",
    lineHeight: "revert-layer",
    overflowX: "revert-layer",
  },
  "&.cm-editor .cm-content": {
    boxSizing: "revert-layer",
    margin: "revert-layer",
    padding: "revert-layer",
    caretColor: "revert-layer",
  },
  ".cm-placeholder": { color: "revert-layer" },
  ".cm-line": { padding: "revert-layer" },
  "&.cm-editor .cm-searchMatch, &.cm-editor .cm-searchMatch-selected": {
    backgroundColor: "revert-layer",
  },
  // The search panel only switches match highlighting on; the find bar is the app's own
  ".cm-panels": { display: "none" },
});

/** In a list, Tab and Shift+Tab nest and unnest the item; elsewhere they keep their default. */
const inList: (command: Command) => Command = (command) => (view) => {
  const node = syntaxTree(view.state).resolveInner(view.state.selection.main.head, -1);
  for (let parent: typeof node | null = node; parent; parent = parent.parent) {
    if (parent.name === "ListItem") return command(view);
  }
  return false;
};

function matchStats(view: EditorView): MatchStats {
  const query = getSearchQuery(view.state);
  if (!query.valid) return { current: 0, total: 0 };
  const { from, to } = view.state.selection.main;
  let total = 0;
  let current = 0;
  const cursor = query.getCursor(view.state);
  for (let match = cursor.next(); !match.done; match = cursor.next()) {
    total++;
    if (match.value.from === from && match.value.to === to) current = total;
  }
  return { current, total };
}

export const MarkdownEditor: Component<MarkdownEditorProps> = (props) => {
  let container: HTMLDivElement | undefined;

  const saveImage = async (documentPath: string, file: File): Promise<string> => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return desktop.invoke("document:save-image", documentPath, file.name, bytes);
  };
  const pendingImages = createPendingImages(saveImage);
  onCleanup(pendingImages.dispose);

  // Saved documents store pasted images in a folder next to them; unsaved ones keep them in memory
  const uploadImage = async (file: File): Promise<string> =>
    props.documentPath ? saveImage(props.documentPath, file) : pendingImages.add(file);

  onMount(() => {
    if (!container) return;
    let headings: OutlineHeading[] = [];
    // Counting walks the whole text, so coalesce it while typing in long documents
    const updateStats = debounce(
      (state: EditorState) => props.onStatsChange(countText(readableText(state))),
      200,
    );
    const focusCompartment = new Compartment();
    const typewriterCompartment = new Compartment();
    const spellcheckCompartment = new Compartment();
    const cursorCompartment = new Compartment();
    const baseUrlCompartment = new Compartment();
    const diagramThemeCompartment = new Compartment();

    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: props.markdown,
        extensions: [
          history(),
          closeBrackets(),
          // Backticks pair as well, which the default brackets leave out
          EditorState.languageData.of(() => [
            { closeBrackets: { brackets: ["(", "[", "{", "'", '"', "`"] } },
          ]),
          // Ahead of lang-markdown's Enter, which only continues lists and quotes
          Prec.highest(keymap.of([{ key: "Enter", run: insertParagraphBreak }])),
          keymap.of([
            ...formatKeymap(markdownStyle),
            { key: "Tab", run: inList(indentMore), shift: inList(indentLess) },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          markdown({
            base: commonmarkLanguage,
            extensions: [
              GFM,
              Subscript,
              Superscript,
              emojiSyntax,
              highlight,
              frontMatter,
              math,
              footnotes,
            ],
            codeLanguages: languages,
            completeHTMLTags: false,
          }),
          codeHighlight,
          livePreview,
          renderedBlocks,
          imageInput(uploadImage),
          pasteHtml(markdownStyle),
          baseUrlCompartment.of(documentBaseUrl.of(props.baseUrl)),
          diagramThemeCompartment.of(diagramTheme.of(readDiagramTheme())),
          alertTitles.of(t().editor.alerts),
          textDirection,
          search({ createPanel: () => ({ dom: document.createElement("div") }) }),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ class: "md-document" }),
          layeredStyles,
          placeholder(t().editor.placeholder),
          focusCompartment.of([]),
          typewriterCompartment.of([]),
          spellcheckCompartment.of([]),
          cursorCompartment.of([]),
          restartCursorBlink,
          documentObserver({
            onDocChange: (state) => {
              headings = collectHeadings(state);
              props.onOutlineChange(headings);
              updateStats(state);
            },
            onSelectionChange: (cursor) =>
              props.onActiveHeadingChange(findActiveHeading(headings, cursor)),
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) props.onMarkdownChange(update.state.doc.toString());
          }),
        ],
      }),
    });

    createEffect(() => {
      const {
        focusMode: focus,
        typewriterMode: typewriter,
        typewriterPosition,
        spellcheck,
        cursorShape,
        cursorBlink,
      } = settings();
      view.dispatch({
        effects: [
          focusCompartment.reconfigure(focus ? focusMode : []),
          typewriterCompartment.reconfigure(typewriter ? typewriterMode(typewriterPosition) : []),
          spellcheckCompartment.reconfigure(
            EditorView.contentAttributes.of({ spellcheck: String(spellcheck) }),
          ),
          cursorCompartment.reconfigure(cursorStyle(cursorShape, cursorBlink)),
        ],
      });
    });

    // Save As moves the document without rebuilding the editor; relative images resolve from the new folder
    createEffect(
      on(
        () => props.baseUrl,
        (baseUrl) =>
          view.dispatch({ effects: baseUrlCompartment.reconfigure(documentBaseUrl.of(baseUrl)) }),
        { defer: true },
      ),
    );

    // Diagrams copy the theme's colors and the body font, so they are drawn again when either
    // changes. The appearance effects that set them were created first and have run by now.
    createEffect(
      on(
        [themeApplied, () => settings().bodyFont, () => settings().fallbackFont],
        () =>
          view.dispatch({
            effects: diagramThemeCompartment.reconfigure(diagramTheme.of(readDiagramTheme())),
          }),
        { defer: true },
      ),
    );

    // CodeMirror normalizes line endings, so the baseline is the editor's text rather than the file's
    props.onReady(view.state.doc.toString());
    view.focus();

    const run = (command: Command): MatchStats => {
      if (getSearchQuery(view.state).valid) command(view);
      return matchStats(view);
    };

    props.ref({
      getMarkdown: () => view.state.doc.toString(),
      focus: () => view.focus(),
      scrollTo: (pos) => {
        view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: "start" }) });
        view.focus();
      },
      getSelectedText: () => {
        const { from, to } = view.state.selection.main;
        return view.state.sliceDoc(from, to);
      },
      setSearch: (options) => {
        // Matches are highlighted only while CodeMirror's search panel is open
        if (options.search && !searchPanelOpen(view.state)) openSearchPanel(view);
        view.dispatch({ effects: setSearchQuery.of(new SearchQuery(options)) });
        if (!options.search) closeSearchPanel(view);
        return matchStats(view);
      },
      findNext: () => run(findNext),
      findPrevious: () => run(findPrevious),
      replaceNext: () => run(replaceNext),
      replaceAll: () => run(replaceAll),
      format: (action) => {
        runFormatAction(view, action, markdownStyle());
        view.focus();
      },
      prepareForPrint: async () => {
        const hadFocus = view.hasFocus;
        // The caret would be printed too
        view.contentDOM.blur();
        view.dispatch({ effects: setPrinting.of(true) });
        await Promise.all([prerenderMath(view.state), prerenderDiagrams(view.state)]);
        return () => {
          view.dispatch({ effects: setPrinting.of(false) });
          if (hadFocus) view.focus();
        };
      },
      persistImages: (documentPath) => pendingImages.persist(view, documentPath),
    });

    onCleanup(() => {
      updateStats.clear();
      view.destroy();
    });
  });

  return (
    <ScrollView
      ref={(element) => (container = element)}
      class="size-full overflow-x-hidden print:h-auto print:overflow-visible"
    />
  );
};
