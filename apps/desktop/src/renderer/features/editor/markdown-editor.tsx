import { closeBracketsKeymap } from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
  isolateHistory,
} from "@codemirror/commands";
import {
  foldedRanges,
  foldEffect,
  forceParsing,
  syntaxTree,
  unfoldAll,
} from "@codemirror/language";
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
import { Compartment, EditorState, type Extension, Prec } from "@codemirror/state";
import { type Command, EditorView, keymap, placeholder } from "@codemirror/view";
import { makeEventListener } from "@solid-primitives/event-listener";
import { debounce } from "@solid-primitives/scheduled";
import { createEffect, on, onCleanup, onMount, type Component } from "solid-js";
import { messageOf } from "@shared/errors";
import type { FormatAction } from "@shared/format-actions";
import { ScrollView } from "@/components/ui";
import { imageCaptionClick, imageInput } from "@/features/editor/images/image-widget";
import { closeInlineTags } from "@/features/editor/widgets/html-widget";
import { t } from "@/i18n";
import {
  type DocumentPosition,
  flushDocumentPositions,
  rememberDocumentPosition,
} from "@/lib/document/positions";
import { reportFailure } from "@/lib/errors";
import { escapeHtml } from "@/lib/html";
import { pickImage, saveImageNextTo } from "@/lib/image-files";
import { alertTitles } from "@/lib/markdown/alerts";
import { codeHighlight } from "@/lib/markdown/code-highlight";
import { codeLanguageFor } from "@/lib/markdown/code-languages";
import { documentHtml, markdownFragment } from "@/lib/markdown/document-html";
import { documentBaseUrl, documentFilePath, imageAlt, imageMarkdown } from "@/lib/markdown/images";
import { FULL_PARSE_TIMEOUT_MS, markdownLanguage } from "@/lib/markdown/language";
import { prerenderMath } from "@/lib/markdown/math";
import { diagramTheme, prerenderDiagrams, readDiagramTheme } from "@/lib/markdown/mermaid";
import { findActiveHeading, type OutlineHeading } from "@/lib/markdown/structure";
import { textDirection } from "@/lib/markdown/text-direction";
import { type PendingImages } from "@/lib/pending-images";
import { settings } from "@/lib/settings";
import { type TextStats } from "@/lib/text-stats";
import { themeApplied } from "@/lib/theme";
import { withViewTransition } from "@/lib/view-transition";
import { cursorStyle, restartCursorBlink } from "./cursor";
import { documentKind, documentTitle, textDocumentHtml } from "./document";
import { documentObserver } from "./document-observer";
import { createStatsTracker } from "./document-stats";
import { folding, foldingKeymap } from "./folding";
import {
  formatKeymap,
  insertParagraphBreak,
  insertTable,
  type MarkdownStyle,
  runFormatAction,
} from "./format-commands";
import { leavingBlocks } from "./leave";
import { createOutlineTracker } from "./outline";
import { pasteHtml } from "./paste-html";
import { livePreview, setPrinting } from "./preview/live-preview";
import { renderedBlocks } from "./preview/rendered-blocks";
import { renumberOrderedLists } from "./renumber-lists";
import { scrollToDocument } from "./scroll";
import {
  createMatchCounter,
  type MatchStats,
  type SearchOptions,
  selectedSearchText,
} from "./search";
import { markdownPairing, smartTyping } from "./smart-typing";
import { layeredStyles, scrollArea } from "./styles";
import { focusMode, holdLine, typewriterMode } from "./writing-modes";
import editorCss from "./editor.css?raw";

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
  /** The document as a self-contained HTML page, see lib/markdown/document-html.ts. */
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

/**
 * What shows the document rendered, or nothing in source mode, where the source of every construct
 * is the document: the markers, the tables, the images and the diagrams as they were written.
 */
function previewOf(sourceMode: boolean): Extension {
  return sourceMode ? [] : [livePreview, renderedBlocks, leavingBlocks];
}

/** How long a scroll or a keystroke settles before the place in the document is measured and saved. */
const POSITION_SAVE_DEBOUNCE_MS = 150;

/** In a list, Tab and Shift+Tab nest and unnest the item; elsewhere they keep their default. */
const inList: (command: Command) => Command = (command) => (view) => {
  const node = syntaxTree(view.state).resolveInner(view.state.selection.main.head, -1);
  for (let parent: typeof node | null = node; parent; parent = parent.parent) {
    if (parent.name === "ListItem") return command(view);
  }
  return false;
};

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
    const kind = documentKind(props.documentPath);
    const markdown = kind === "markdown";
    let disposed = false;
    // The props follow the document the window shows, and by the time this editor is cleaned up
    // that is already the next one; what it showed itself is kept here instead
    let path = props.documentPath;
    const stats = createStatsTracker((next) => props.onStatsChange(next));
    const matches = createMatchCounter((next) => props.onMatchStatsChange(next));
    const outline = createOutlineTracker((next) => props.onOutlineChange(next));

    const focusCompartment = new Compartment();
    const typewriterCompartment = new Compartment();
    const spellcheckCompartment = new Compartment();
    const cursorCompartment = new Compartment();
    const baseUrlCompartment = new Compartment();
    const documentPathCompartment = new Compartment();
    const diagramThemeCompartment = new Compartment();
    const previewCompartment = new Compartment();
    const pairingCompartment = new Compartment();
    const languageCompartment = new Compartment();

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
          ...(markdown
            ? [
                smartTyping(() => ({
                  smartQuotes: settings().smartQuotes,
                  smartDashes: settings().smartDashes,
                })),
                pairingCompartment.of(markdownPairing(settings().autoPairMarkdown)),
                // Ahead of lang-markdown's Enter, which only continues lists and quotes
                Prec.highest(keymap.of([{ key: "Enter", run: insertParagraphBreak }])),
              ]
            : []),
          keymap.of([
            ...(markdown ? formatKeymap(markdownStyle) : []),
            ...(markdown
              ? [{ key: "Tab", run: inList(indentMore), shift: inList(indentLess) }]
              : []),
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...foldingKeymap,
            ...historyKeymap,
          ]),
          languageCompartment.of(markdown ? markdownLanguage : []),
          // After the language, so lang-html closes the block tags it can read from the tree
          ...(markdown ? [closeInlineTags()] : []),
          folding({
            fold: t().editor.fold,
            unfold: t().editor.unfold,
            foldedText: t().editor.foldedText,
          }),
          codeHighlight,
          ...(markdown
            ? [
                renumberOrderedLists(),
                imageInput(uploadImage),
                imageCaptionClick(),
                pasteHtml(markdownStyle),
                alertTitles.of(t().editor.alerts),
              ]
            : []),
          previewCompartment.of(markdown ? previewOf(settings().sourceMode) : []),
          baseUrlCompartment.of(markdown ? documentBaseUrl.of(props.baseUrl) : []),
          documentPathCompartment.of(markdown ? documentFilePath.of(props.documentPath) : []),
          diagramThemeCompartment.of(markdown ? diagramTheme.of(readDiagramTheme()) : []),
          textDirection,
          search({ createPanel: () => ({ dom: document.createElement("div") }) }),
          ...(kind === "code" ? [] : [EditorView.lineWrapping]),
          EditorView.contentAttributes.of({
            class: "md-document md-text-cursor",
            "data-document-kind": kind,
          }),
          layeredStyles,
          ...(markdown ? [placeholder(t().editor.placeholder)] : []),
          focusCompartment.of([]),
          typewriterCompartment.of([]),
          spellcheckCompartment.of([]),
          cursorCompartment.of([]),
          restartCursorBlink,
          documentObserver(
            {
              onDocChange: (state, update) => {
                // Parsing the rest of a small document is not an edit, but it can make its count exact
                if (!outline.update(state, update)) stats.refresh(state);
              },
              onPositionChange: (position) =>
                props.onActiveHeadingChange(findActiveHeading(outline.current(), position)),
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

    // A code grammar is a module of its own, so the text shows at once and takes its colors when
    // the grammar arrives. A text file has no grammar to wait for.
    if (kind === "code" && props.documentPath !== undefined) {
      const language = codeLanguageFor(props.documentPath);
      void language?.load().then((support) => {
        if (!disposed) view.dispatch({ effects: languageCompartment.reconfigure(support) });
      });
    }

    // Source mode only swaps extensions, so the text, the caret, the scroll and the undo history stay
    // as they are. The editor remembers the mode it is set to itself, because printing shows the
    // rendered document even in source mode without the setting changing.
    let sourceConfigured = settings().sourceMode;
    const showSource = (sourceMode: boolean, animate = true): void => {
      if (!markdown || sourceConfigured === sourceMode) return;
      sourceConfigured = sourceMode;
      const reconfigure = () =>
        view.dispatch({ effects: previewCompartment.reconfigure(previewOf(sourceMode)) });
      // The markers, the renderings and every line's height change at once: the window cross-fades
      // the two states instead of the document flashing from one to the other
      if (animate) withViewTransition(reconfigure);
      else reconfigure();
    };

    // The setting may be changed from the View menu, the settings window or a folder's own file
    createEffect(
      on(
        () => settings().sourceMode,
        (sourceMode) => {
          if (markdown) showSource(sourceMode);
        },
      ),
    );

    // Only the characters that pair change, so the setting swaps that one extension and keeps the
    // text, the caret and the undo history as they are
    createEffect(
      on(
        () => settings().autoPairMarkdown,
        (autoPairMarkdown) => {
          if (!markdown) return;
          view.dispatch({
            effects: pairingCompartment.reconfigure(markdownPairing(autoPairMarkdown)),
          });
        },
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
      return matches.request(view);
    };

    const insertImage = async () => {
      // Only a Markdown document links a picture with Markdown syntax
      if (!markdown) return;
      try {
        const file = await pickImage();
        if (file === null) return;
        const src = await uploadImage(file);
        const link = imageMarkdown(imageAlt(file.name), src);
        // Picking and writing took a moment, so the caret the image goes to is read again here
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: link },
          selection: { anchor: from + link.length },
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
        // A version that replaces the whole document swaps every rendering at once; the window
        // cross-fades the two texts instead of flashing the restored text in
        withViewTransition(() =>
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: text },
            // A restored version starts at its own beginning, whatever was selected before
            selection: { anchor: 0 },
            scrollIntoView: true,
            // A change made by the app rather than typed would otherwise fold into the typing just
            // before it, and one Undo would take back more than the version that was restored
            annotations: [isolateHistory.of("full")],
          }),
        );
        view.focus();
      },
      scrollTo: (pos) => {
        // The caret goes with the scroll, so the outline marks the heading that was chosen even
        // when the document is too short to bring it to the top
        view.dispatch({ selection: { anchor: pos } });
        scrollToDocument(view, pos);
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
      getSelectedText: () => selectedSearchText(view.state),
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
        return matches.request(view);
      },
      findNext: () => run(findNext),
      findPrevious: () => run(findPrevious),
      replaceNext: () => run(replaceNext),
      replaceAll: () => run(replaceAll),
      format: (action) => {
        // A text or code file has no Markdown syntax to insert
        if (!markdown) return;
        runFormatAction(view, action, markdownStyle());
        view.focus();
      },
      insertTable: (rows, columns) => {
        if (!markdown) return;
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
        const restore = () => {
          // The folds go back to the lines they were made on, unless the document was edited
          // while it was being printed and they would stand for something else now
          if (folded.length > 0 && view.state.doc.eq(printed)) {
            view.dispatch({ effects: folded.map((range) => foldEffect.of(range)) });
          }
          if (hadFocus) view.focus();
        };
        if (!markdown) return restore;
        // A printout is always the rendered document, so source mode gives the preview back for it
        // and takes it out again afterwards. The extensions go in first: a printing field added by
        // the same change would not see the effect that turns printing on.
        const sourceMode = sourceConfigured;
        showSource(false, false);
        view.dispatch({ effects: setPrinting.of(true) });
        forceParsing(view, view.state.doc.length, FULL_PARSE_TIMEOUT_MS);
        await Promise.all([prerenderMath(view.state), prerenderDiagrams(view.state)]);
        return () => {
          view.dispatch({ effects: setPrinting.of(false) });
          showSource(sourceMode, false);
          restore();
        };
      },
      persistImages: (documentPath) =>
        markdown ? props.pendingImages.persistView(view, documentPath) : Promise.resolve(),
      insertImage,
      toHtml: async () => {
        if (!markdown) {
          return textDocumentHtml(documentTitle(props.documentPath), view.state.doc.toString());
        }
        forceParsing(view, view.state.doc.length, FULL_PARSE_TIMEOUT_MS);
        return documentHtml(view.state, documentTitle(props.documentPath), editorCss);
      },
      toHtmlFragment: async () => {
        const { from, to } = view.state.selection.main;
        // Nothing selected copies the whole document
        const text = from === to ? view.state.sliceDoc(0) : view.state.sliceDoc(from, to);
        if (!markdown) return { markdown: text, html: `<pre>${escapeHtml(text)}</pre>` };
        return { markdown: text, html: await markdownFragment(view.state, text) };
      },
    });

    onCleanup(() => {
      disposed = true;
      outline.dispose();
      schedulePositionSave.clear();
      matches.cancel();
      stats.dispose();
      // The view is gone once this returns, so the place has to be taken from it beforehand
      savePosition();
      flushDocumentPositions();
      view.destroy();
    });
  });

  return <ScrollView ref={(element) => (container = element)} class={scrollArea} />;
};
