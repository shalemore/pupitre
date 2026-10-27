import { closeBracketsKeymap } from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
  isolateHistory,
} from "@codemirror/commands";
import { foldedRanges, foldEffect, syntaxTree, unfoldAll } from "@codemirror/language";
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
import { type ChangeDesc, Compartment, EditorState, type Extension, Prec } from "@codemirror/state";
import { type Command, EditorView, keymap, placeholder } from "@codemirror/view";
import { makeEventListener } from "@solid-primitives/event-listener";
import { debounce } from "@solid-primitives/scheduled";
import { createEffect, on, onCleanup, onMount, type Component } from "solid-js";
import type { FormatAction } from "@shared/format";
import { ScrollView } from "@/components/ui";
import { documentHtml, markdownFragment } from "@/features/export/document-html";
import { t } from "@/i18n";
import {
  type DocumentPosition,
  flushDocumentPositions,
  rememberDocumentPosition,
} from "@/lib/document-positions";
import { messageOf, reportFailure } from "@/lib/errors";
import { fileNameOf, withoutDocumentExtension } from "@/lib/file";
import { settings } from "@/lib/settings";
import { type TextStats } from "@/lib/text-stats";
import { themeApplied } from "@/lib/theme";
import { alertTitles } from "./alerts";
import { codeHighlight } from "./code-highlight";
import { cursorStyle, restartCursorBlink } from "./cursor";
import { createStatsTracker } from "./document-stats";
import {
  canShiftHeadings,
  collectHeadings,
  documentObserver,
  findActiveHeading,
  mergeHeadings,
  type OutlineHeading,
} from "./document-structure";
import { folding, foldingKeymap } from "./folding";
import {
  formatKeymap,
  insertParagraphBreak,
  insertTable,
  type MarkdownStyle,
  runFormatAction,
} from "./format-commands";
import {
  type PendingImages,
  documentBaseUrl,
  documentFilePath,
  imageAlt,
  imageInput,
  imageMarkdown,
  pickImage,
  saveImageNextTo,
} from "./images";
import { livePreview, setPrinting } from "./live-preview";
import { markdownLanguage } from "./markdown-language";
import { prerenderMath } from "./math";
import { diagramTheme, prerenderDiagrams, readDiagramTheme } from "./mermaid";
import { pasteHtml } from "./paste-html";
import { renderedBlocks } from "./rendered-blocks";
import { renumberOrderedLists } from "./renumber-lists";
import { markdownPairing, smartTyping } from "./smart-typing";
import { textDirection } from "./text-direction";
import { focusMode, holdLine, typewriterMode } from "./writing-modes";

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
  /** The total is still being counted; the arrows can be used meanwhile. */
  pending?: boolean;
  /** The document has more matches than the count is willing to walk. */
  capped?: boolean;
}

export interface MarkdownEditorHandle {
  getMarkdown: () => string;
  /** The document length, which a caller can read without copying the text. */
  getMarkdownLength: () => number;
  focus: () => void;
  /**
   * Replaces the whole text in one change, so a version picked from the history can be undone with
   * the undo of an ordinary edit; the view's own state changes rather than being rebuilt, which is
   * what keeps the caret, the scroll and the undo history around it.
   */
  replaceDocument: (text: string) => void;
  scrollTo: (pos: number) => void;
  getSelectedText: () => string;
  /** Inserts the clipboard's text at the caret without the rich-text conversion a paste applies. */
  pastePlainText: (text: string) => void;
  /** Selects a range of the text, scrolls it into view and gives the editor the focus; used to show a match found in the folder. */
  revealRange: (from: number, to: number) => void;
  setSearch: (options: SearchOptions) => MatchStats;
  findNext: () => MatchStats;
  findPrevious: () => MatchStats;
  replaceNext: () => MatchStats;
  replaceAll: () => MatchStats;
  format: (action: FormatAction) => void;
  /**
   * Inserts an empty table of that many rows and columns, the rows counting the header, and puts the
   * caret in its first body cell.
   */
  insertTable: (rows: number, columns: number) => void;
  /**
   * Shows the whole document rendered and waits for fonts and diagrams, so a printout is complete;
   * the returned function goes back to editing.
   */
  prepareForPrint: () => Promise<() => void>;
  /** Writes images pasted before the document had a file next to it, see images.ts. */
  persistImages: (documentPath: string) => Promise<void>;
  /** Asks for an image file and links it at the caret, the way a pasted picture is linked. */
  insertImage: () => Promise<void>;
  /** The document as a self-contained HTML page, see features/export/document-html.ts. */
  toHtml: () => Promise<string>;
  /**
   * The selection, or the whole document when nothing is selected, as the Markdown that was
   * copied and as the HTML fragment that stands for it in another application.
   */
  toHtmlFragment: () => Promise<{ markdown: string; html: string }>;
}

export interface MarkdownEditorProps {
  markdown: string;
  /** Where the reader left this document; applied once, when the editor is built for it. */
  initialPosition: DocumentPosition | undefined;
  /** file:// URL of the document folder, to resolve relative image paths; undefined if unsaved. */
  baseUrl: string | undefined;
  /** Path of the document; pasted images are saved next to it. */
  documentPath: string | undefined;
  /**
   * Pictures pasted into the document before it had a file. They belong to the tab rather than to
   * the editor, which is rebuilt every time another tab is shown.
   */
  pendingImages: PendingImages;
  /** Called once the editor exists, with its content as the clean baseline. */
  onReady: (markdown: string) => void;
  onMarkdownChange: () => void;
  onOutlineChange: (headings: OutlineHeading[]) => void;
  onActiveHeadingChange: (index: number) => void;
  onStatsChange: (stats: TextStats) => void;
  /** A count that had to be made in the background, once it is ready. */
  onMatchStatsChange: (stats: MatchStats) => void;
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

/** The title of an exported page: the document's file name without its extension. */
function documentTitle(path: string | undefined): string {
  return withoutDocumentExtension(path ? fileNameOf(path) : t().common.untitledFileName);
}

/**
 * What shows the document rendered, or nothing in source mode, where the source of every construct
 * is the document: the markers, the tables, the images and the diagrams as they were written.
 */
function previewOf(sourceMode: boolean): Extension {
  return sourceMode ? [] : [livePreview, renderedBlocks];
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
  // The fold gutter is not a column of its own (editor.css), so it wears neither of CodeMirror's
  // color schemes: its surface comes from the layers, where a theme can give it one
  "&.cm-editor .cm-gutters": {
    backgroundColor: "revert-layer",
    color: "revert-layer",
    border: "revert-layer",
  },
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

const OUTLINE_DEBOUNCE_MS = 150;
const POSITION_SAVE_DEBOUNCE_MS = 150;
// Counting every match of a large document is another walk through the whole text; below this
// size it is cheap enough to do before returning, above it the count runs in slices
const SYNC_MATCH_LIMIT = 512 * 1024;
// A find bar does not need the exact number of matches in a book-length document
const MAX_COUNTED_MATCHES = 1_000;
const MATCH_COUNT_SLICE_MS = 8;
const MAX_INITIAL_SEARCH_LENGTH = 200;

function countMatches(state: EditorState, query: SearchQuery): MatchStats {
  const { from, to } = state.selection.main;
  let total = 0;
  let current = 0;
  const cursor = query.getCursor(state);
  for (let match = cursor.next(); !match.done; match = cursor.next()) {
    total++;
    if (match.value.from === from && match.value.to === to) current = total;
  }
  return { current, total };
}

async function countMatchesInSlices(
  state: EditorState,
  query: SearchQuery,
  cancelled: () => boolean,
): Promise<MatchStats | undefined> {
  const { from, to } = state.selection.main;
  let total = 0;
  let current = 0;
  const cursor = query.getCursor(state);

  const runSlice = async (): Promise<MatchStats | undefined> => {
    const deadline = performance.now() + MATCH_COUNT_SLICE_MS;
    while (performance.now() < deadline) {
      const match = cursor.next();
      if (match.done) return { current, total };
      total++;
      if (match.value.from === from && match.value.to === to) current = total;
      if (total >= MAX_COUNTED_MATCHES) return { current, total, capped: true };
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (cancelled()) return undefined;
    return runSlice();
  };

  return runSlice();
}

export const MarkdownEditor: Component<MarkdownEditorProps> = (props) => {
  let container: HTMLDivElement | undefined;

  // Saved documents store pasted images in a folder next to them; unsaved ones keep them in memory
  const uploadImage = async (file: File): Promise<string> =>
    props.documentPath ? saveImageNextTo(props.documentPath, file) : props.pendingImages.add(file);

  onMount(() => {
    if (!container) return;
    // CodeMirror scrolls a document taller than the window in the ScrollView around it rather than
    // in its own scroller, so that is where a place in the document is measured from
    const scroller = container;
    // The props follow the document the window shows, and by the time this editor is cleaned up
    // that is already the next one; what it showed itself is kept here instead
    let path = props.documentPath;
    let headings: OutlineHeading[] = [];
    let outlineStarted = false;
    let observedDoc: EditorState["doc"] | undefined;
    const stats = createStatsTracker((next) => props.onStatsChange(next));
    let matchRun = 0;

    /**
     * The match count the find bar shows. A small document is counted before the answer returns;
     * a large one starts a cancelled-on-new-search background count and says it is pending.
     */
    const requestMatchStats = (view: EditorView): MatchStats => {
      const query = getSearchQuery(view.state);
      if (!query.valid || query.search === "") {
        matchRun++;
        return { current: 0, total: 0 };
      }
      if (view.state.doc.length <= SYNC_MATCH_LIMIT) {
        matchRun++;
        return countMatches(view.state, query);
      }
      const run = ++matchRun;
      void countMatchesInSlices(view.state, query, () => run !== matchRun).then((counted) => {
        if (counted !== undefined && run === matchRun) props.onMatchStatsChange(counted);
      });
      return { current: 0, total: 0, pending: true };
    };

    let outlineDirty = false;
    let pendingOutlineChanges: ChangeDesc | undefined;
    // The outline only changes when a heading does, but collecting it walks the parsed tree; let
    // the keystrokes settle first so typing never waits for a list of thousands of rows
    const updateOutline = debounce((state: EditorState) => {
      if (!outlineDirty && pendingOutlineChanges !== undefined) {
        const changes = pendingOutlineChanges;
        pendingOutlineChanges = undefined;
        for (const heading of headings) {
          heading.pos = changes.mapPos(heading.pos);
        }
        return;
      }
      outlineDirty = false;
      pendingOutlineChanges = undefined;
      const next = mergeHeadings(headings, collectHeadings(state));
      if (next === headings) return;
      headings = next;
      props.onOutlineChange(headings);
    }, OUTLINE_DEBOUNCE_MS);

    const focusCompartment = new Compartment();
    const typewriterCompartment = new Compartment();
    const spellcheckCompartment = new Compartment();
    const cursorCompartment = new Compartment();
    const baseUrlCompartment = new Compartment();
    const documentPathCompartment = new Compartment();
    const diagramThemeCompartment = new Compartment();
    const previewCompartment = new Compartment();
    const pairingCompartment = new Compartment();

    // While the saved place is still on its way the editor must not save its own, or the top of
    // the document would replace the place it is about to go back to
    let restoring = props.initialPosition !== undefined;
    const savePosition = () => {
      if (restoring) return;
      // A document with no file behind it has no place to come back to
      if (path === undefined) return;
      // The place is kept as the text that was read, not as a scroll height: CodeMirror only
      // estimates the height of the lines above the window until they have been in view, so a
      // height comes back a line or two away from where it was
      const height = scroller.getBoundingClientRect().top - view.documentTop;
      const top = view.lineBlockAtHeight(height);
      rememberDocumentPosition(path, {
        caret: view.state.selection.main.head,
        topLine: top.from,
        topOffset: top.top - height,
      });
    };
    // Measuring the scroll position reads layout, so keystrokes and scroll frames coalesce it
    const schedulePositionSave = debounce(savePosition, POSITION_SAVE_DEBOUNCE_MS);

    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: props.markdown,
        extensions: [
          history(),
          smartTyping(() => ({
            smartQuotes: settings().smartQuotes,
            smartDashes: settings().smartDashes,
          })),
          pairingCompartment.of(markdownPairing(settings().autoPairMarkdown)),
          // Ahead of lang-markdown's Enter, which only continues lists and quotes
          Prec.highest(keymap.of([{ key: "Enter", run: insertParagraphBreak }])),
          keymap.of([
            ...formatKeymap(markdownStyle),
            { key: "Tab", run: inList(indentMore), shift: inList(indentLess) },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...foldingKeymap,
            ...historyKeymap,
          ]),
          markdownLanguage,
          folding({
            fold: t().editor.fold,
            unfold: t().editor.unfold,
            foldedText: t().editor.foldedText,
          }),
          codeHighlight,
          renumberOrderedLists(),
          previewCompartment.of(previewOf(settings().sourceMode)),
          imageInput(uploadImage),
          pasteHtml(markdownStyle),
          baseUrlCompartment.of(documentBaseUrl.of(props.baseUrl)),
          documentPathCompartment.of(documentFilePath.of(props.documentPath)),
          diagramThemeCompartment.of(diagramTheme.of(readDiagramTheme())),
          alertTitles.of(t().editor.alerts),
          textDirection,
          search({ createPanel: () => ({ dom: document.createElement("div") }) }),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ class: "md-document md-text-cursor" }),
          layeredStyles,
          placeholder(t().editor.placeholder),
          focusCompartment.of([]),
          typewriterCompartment.of([]),
          spellcheckCompartment.of([]),
          cursorCompartment.of([]),
          restartCursorBlink,
          documentObserver(
            {
              onDocChange: (state, update) => {
                const docChanged = state.doc !== observedDoc;
                observedDoc = state.doc;
                // The first outline is built as the editor opens, so its rows are not assembled
                // under the first keystrokes; later changes wait for a pause, and prose edits that
                // touch no heading only shift the positions of the headings below them
                if (!outlineStarted) {
                  outlineStarted = true;
                  headings = collectHeadings(state);
                  props.onOutlineChange(headings);
                } else {
                  if (
                    !docChanged ||
                    update === undefined ||
                    outlineDirty ||
                    !canShiftHeadings(headings, update)
                  ) {
                    outlineDirty = true;
                    pendingOutlineChanges = undefined;
                  } else {
                    pendingOutlineChanges =
                      pendingOutlineChanges === undefined
                        ? update.changes.desc
                        : pendingOutlineChanges.composeDesc(update.changes.desc);
                  }
                  updateOutline(state);
                }
                // Parsing the rest of a small document is not an edit, but it can make its count exact
                if (!docChanged) stats.refresh(state);
              },
              onPositionChange: (position) =>
                props.onActiveHeadingChange(findActiveHeading(headings, position)),
            },
            scroller,
          ),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              props.onMarkdownChange();
              stats.changed(update);
            }
            if (update.selectionSet) {
              schedulePositionSave();
              if (!update.docChanged) stats.selection(update.state);
            }
          }),
        ],
      }),
    });

    stats.start(view.state);

    // Source mode only swaps extensions, so the text, the caret, the scroll and the undo history stay
    // as they are. The editor remembers the mode it is set to itself, because printing shows the
    // rendered document even in source mode without the setting changing.
    let sourceConfigured = settings().sourceMode;
    const showSource = (sourceMode: boolean): void => {
      if (sourceConfigured === sourceMode) return;
      sourceConfigured = sourceMode;
      view.dispatch({ effects: previewCompartment.reconfigure(previewOf(sourceMode)) });
    };

    // The setting may be changed from the View menu, the settings window or a folder's own file
    createEffect(on(() => settings().sourceMode, showSource));

    // Only the characters that pair change, so the setting swaps that one extension and keeps the
    // text, the caret and the undo history as they are
    createEffect(
      on(
        () => settings().autoPairMarkdown,
        (autoPairMarkdown) =>
          view.dispatch({
            effects: pairingCompartment.reconfigure(markdownPairing(autoPairMarkdown)),
          }),
        { defer: true },
      ),
    );

    createEffect(() => {
      const {
        focusMode: focus,
        focusModeGrain,
        typewriterMode: typewriter,
        typewriterPosition,
        typewriterFixed,
        spellcheck,
        cursorShape,
        cursorBlink,
      } = settings();
      view.dispatch({
        effects: [
          focusCompartment.reconfigure(focus ? focusMode(focusModeGrain) : []),
          typewriterCompartment.reconfigure(
            typewriter ? typewriterMode(typewriterPosition, typewriterFixed) : [],
          ),
          spellcheckCompartment.reconfigure(
            EditorView.contentAttributes.of({ spellcheck: String(spellcheck) }),
          ),
          cursorCompartment.reconfigure(cursorStyle(cursorShape, cursorBlink)),
        ],
      });
    });

    // A held line takes its place at once, whether the mode is switched on or moved
    createEffect(
      on(
        () =>
          settings().typewriterMode && settings().typewriterFixed
            ? settings().typewriterPosition
            : false,
        (position) => {
          if (position) {
            view.dispatch({
              effects: holdLine(view.state.selection.main.head, position),
            });
          }
        },
      ),
    );

    // Save As and a rename move the document without rebuilding the editor, and the place it is at
    // belongs to the file it now lives in
    createEffect(
      on(
        () => props.documentPath,
        (nextPath) => {
          path = nextPath;
          view.dispatch({
            effects: documentPathCompartment.reconfigure(documentFilePath.of(nextPath)),
          });
        },
        { defer: true },
      ),
    );

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

    // CodeMirror keeps the text as a rope, so the string it was built from is the same text the
    // editor holds; copying it back would duplicate a large document for no reason. A lone carriage
    // return is the one character CodeMirror rewrites, so that case still reads the rope back.
    props.onReady(props.markdown.includes("\r") ? view.state.doc.toString() : props.markdown);
    view.focus();

    // The place is put back from the text it was taken from: the caret, and the line that was at
    // the top of the editor with as much of it cut off as was before
    const initialPosition = props.initialPosition;
    if (initialPosition) {
      // A file can have grown shorter since it was last read, so its places sit at its end at most
      const length = view.state.doc.length;
      view.dispatch({ selection: { anchor: Math.min(initialPosition.caret, length) } });
      if (settings().typewriterMode) {
        // Typewriter mode holds the line being written in place and scrolls there itself; the line
        // that was at the top would only fight it
        restoring = false;
      } else {
        const topLine = Math.min(initialPosition.topLine, length);
        view.dispatch({
          effects: EditorView.scrollIntoView(topLine, {
            // The line's top sat above the top edge by as much as it was cut off, and a negative
            // margin keeps that: the place is put back where it was rather than at the edge
            y: "start",
            yMargin: initialPosition.topOffset,
          }),
        });
        // CodeMirror only estimates the height of the lines above the window until it has measured
        // them, so the scroll settles over the next frames; reading the place back before that
        // would save where it landed rather than where it was
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            restoring = false;
          }),
        );
      }
    }

    // Scrolling does not change the document, so the update listener does not report it
    makeEventListener(scroller, "scroll", schedulePositionSave, { passive: true });
    // A window that closes before the next write of the places was due keeps them all the same
    makeEventListener(window, "pagehide", () => {
      schedulePositionSave.clear();
      savePosition();
      flushDocumentPositions();
    });

    const run = (command: Command): MatchStats => {
      if (getSearchQuery(view.state).valid) command(view);
      return requestMatchStats(view);
    };

    const insertImage = async () => {
      try {
        const file = await pickImage();
        if (file === null) return;
        const src = await uploadImage(file);
        const markdown = imageMarkdown(imageAlt(file.name), src);
        // Picking and writing took a moment, so the caret the image goes to is read again here
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: markdown },
          selection: { anchor: from + markdown.length },
          scrollIntoView: true,
        });
        view.focus();
      } catch (error) {
        await reportFailure(t().dialogs.imageFailed, messageOf(error));
      }
    };

    props.ref({
      getMarkdown: () => view.state.doc.toString(),
      getMarkdownLength: () => view.state.doc.length,
      focus: () => view.focus(),
      replaceDocument: (text) => {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
          // A restored version starts at its own beginning, whatever was selected before
          selection: { anchor: 0 },
          scrollIntoView: true,
          // A change made by the app rather than typed would otherwise fold into the typing just
          // before it, and one Undo would take back more than the version that was restored
          annotations: [isolateHistory.of("full")],
        });
        view.focus();
      },
      scrollTo: (pos) => {
        // The caret goes with the scroll, so the outline marks the heading that was chosen even
        // when the document is too short to bring it to the top
        view.dispatch({
          selection: { anchor: pos },
          effects: EditorView.scrollIntoView(pos, { y: "start" }),
        });
        view.focus();
      },
      revealRange: (from, to) => {
        // The document may have been edited since the search read it from disk
        const length = view.state.doc.length;
        const start = Math.min(from, length);
        view.dispatch({
          selection: { anchor: start, head: Math.min(to, length) },
          effects: EditorView.scrollIntoView(start, { y: "center" }),
        });
        view.focus();
      },
      getSelectedText: () => {
        const { from, to } = view.state.selection.main;
        if (to === from || to - from > MAX_INITIAL_SEARCH_LENGTH) return "";
        const selected = view.state.sliceDoc(from, to);
        return selected.includes("\n") ? "" : selected;
      },
      pastePlainText: (text) => {
        view.focus();
        view.dispatch(view.state.replaceSelection(text), {
          scrollIntoView: true,
          userEvent: "input.paste",
        });
      },
      setSearch: (options) => {
        // Matches are highlighted only while CodeMirror's search panel is open
        if (options.search && !searchPanelOpen(view.state)) openSearchPanel(view);
        view.dispatch({ effects: setSearchQuery.of(new SearchQuery(options)) });
        if (!options.search) closeSearchPanel(view);
        return requestMatchStats(view);
      },
      findNext: () => run(findNext),
      findPrevious: () => run(findPrevious),
      replaceNext: () => run(replaceNext),
      replaceAll: () => run(replaceAll),
      format: (action) => {
        runFormatAction(view, action, markdownStyle());
        view.focus();
      },
      insertTable: (rows, columns) => {
        // The live preview opens the cell the caret lands in only for a change made while the
        // editor has the focus, and the size dialog held that until the size was picked
        view.focus();
        insertTable(view, rows, columns);
      },
      prepareForPrint: async () => {
        const hadFocus = view.hasFocus;
        // The caret would be printed too
        view.contentDOM.blur();
        // A fold is a way of reading the document, not a part of it, so a printout shows it whole
        const printed = view.state.doc;
        const folded: { from: number; to: number }[] = [];
        foldedRanges(view.state).between(0, view.state.doc.length, (from, to) => {
          folded.push({ from, to });
        });
        unfoldAll(view);
        // A printout is always the rendered document, so source mode gives the preview back for it
        // and takes it out again afterwards. The extensions go in first: a printing field added by
        // the same change would not see the effect that turns printing on.
        const sourceMode = sourceConfigured;
        showSource(false);
        view.dispatch({ effects: setPrinting.of(true) });
        await Promise.all([prerenderMath(view.state), prerenderDiagrams(view.state)]);
        return () => {
          view.dispatch({ effects: setPrinting.of(false) });
          showSource(sourceMode);
          // The folds go back to the lines they were made on, unless the document was edited
          // while it was being printed and they would stand for something else now
          if (folded.length > 0 && view.state.doc.eq(printed)) {
            view.dispatch({ effects: folded.map((range) => foldEffect.of(range)) });
          }
          if (hadFocus) view.focus();
        };
      },
      persistImages: (documentPath) => props.pendingImages.persistView(view, documentPath),
      insertImage,
      toHtml: () => documentHtml(view.state, documentTitle(props.documentPath)),
      toHtmlFragment: async () => {
        const { from, to } = view.state.selection.main;
        // Nothing selected copies the whole document
        const markdown = from === to ? view.state.sliceDoc(0) : view.state.sliceDoc(from, to);
        return { markdown, html: await markdownFragment(view.state, markdown) };
      },
    });

    onCleanup(() => {
      updateOutline.clear();
      schedulePositionSave.clear();
      matchRun++;
      stats.dispose();
      // The view is gone once this returns, so the place has to be taken from it beforehand
      savePosition();
      flushDocumentPositions();
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
