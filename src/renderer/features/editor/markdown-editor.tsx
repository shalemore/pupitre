import { debounce } from "@solid-primitives/scheduled";
import { EditorView as CodeMirrorView } from "@codemirror/view";
import { languages } from "@codemirror/language-data";
import { Crepe } from "@milkdown/crepe";
import { editorViewCtx, remarkStringifyOptionsCtx } from "@milkdown/kit/core";
import type { Node } from "@milkdown/kit/prose/model";
import type { Command } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import {
  findNext,
  findPrev,
  getSearchState,
  replaceAll,
  replaceNext,
  search,
  SearchQuery,
  setSearchState,
} from "prosemirror-search";
import type { FormatAction } from "@shared/format";
import type { Settings } from "@shared/settings";
import {
  createEffect,
  getOwner,
  on,
  onCleanup,
  onMount,
  runWithOwner,
  type Component,
} from "solid-js";
import { ScrollView } from "@/components/ui";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { settings } from "@/lib/settings";
import { countText, type TextStats } from "@/lib/text-stats";
import { githubAlerts } from "./alerts";
import { codeHighlight } from "./code-highlight";
import { formatKeymap, runFormatAction } from "./format-commands";
import { frontMatter } from "./front-matter";
import { preserveImageAlt } from "./image-block-schema";
import { renderMermaidPreview } from "./mermaid-preview";
import { createPendingImages } from "./pending-images";
import {
  collectHeadings,
  documentObserverPlugin,
  findActiveHeading,
  type OutlineHeading,
  readableText,
} from "./prose-plugins";
import { details } from "./details";
import { editableHtmlSchema, rawHtml } from "./raw-html";
import { syntaxRevealPlugin } from "./syntax-reveal";
import { textDirectionPlugin } from "./text-direction";
import { focusModePlugin, typewriterModePlugin } from "./writing-modes";

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
  /** Writes images pasted before the document had a file next to it, see pending-images.ts. */
  persistImages: (documentPath: string) => Promise<void>;
}

export interface MarkdownEditorProps {
  markdown: string;
  /** file:// URL of the document folder, to resolve relative image paths; undefined if unsaved. */
  baseUrl: string | undefined;
  /** Path of the document; pasted images are saved next to it. */
  documentPath: string | undefined;
  /** Called once the editor exists, with the parsed-then-serialized document as the clean baseline. */
  onReady: (markdown: string) => void;
  onMarkdownChange: (markdown: string) => void;
  onOutlineChange: (headings: OutlineHeading[]) => void;
  onActiveHeadingChange: (index: number) => void;
  onStatsChange: (stats: TextStats) => void;
  ref: (handle: MarkdownEditorHandle) => void;
}

/**
 * How Markdown is written on save, as remark-stringify options. Milkdown reads them only when the
 * editor is created, so a changed setting applies to documents opened afterwards.
 */
function markdownStyle(preferences: Settings) {
  return {
    bullet: preferences.bulletMarker,
    emphasis: preferences.emphasisMarker,
    strong: preferences.strongMarker,
    rule: preferences.ruleMarker,
    fence: preferences.fenceMarker,
    incrementListMarker: preferences.incrementListMarker,
    listItemIndent: "one",
  } as const;
}

function matchStats(view: EditorView): MatchStats {
  const query = getSearchState(view.state)?.query;
  if (!query?.valid) return { current: 0, total: 0 };
  const { from, to } = view.state.selection;
  let total = 0;
  let current = 0;
  let pos = 0;
  for (
    let result = query.findNext(view.state, pos);
    result;
    result = query.findNext(view.state, pos)
  ) {
    total++;
    if (result.from === from && result.to === to) current = total;
    // Step past empty matches (such as the regexp ^) to avoid an endless loop
    pos = result.to > result.from ? result.to : result.to + 1;
  }
  return { current, total };
}

export const MarkdownEditor: Component<MarkdownEditorProps> = (props) => {
  let container: HTMLDivElement | undefined;
  let view: EditorView | undefined;

  const resolveUrl = (url: string): string => {
    if (!props.baseUrl || URL.canParse(url)) return url;
    return new URL(url, props.baseUrl).href;
  };

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
    const labels = t().editor;
    const crepe = new Crepe({
      root: container,
      defaultValue: props.markdown,
      // Typora-style editing: formatting comes from the keyboard, the Format menu and the
      // context menu, not from floating toolbars, block handles or a slash menu
      features: {
        [Crepe.Feature.TopBar]: false,
        [Crepe.Feature.AI]: false,
        [Crepe.Feature.Toolbar]: false,
        [Crepe.Feature.BlockEdit]: false,
      },
      featureConfigs: {
        [Crepe.Feature.CodeMirror]: {
          languages,
          theme: codeHighlight,
          extensions: [CodeMirrorView.lineWrapping],
          searchPlaceholder: labels.searchLanguage,
          noResultText: labels.noLanguage,
          copyText: t().common.copy,
          previewLabel: labels.preview,
          previewToggleText: (previewOnly) =>
            previewOnly ? labels.editSource : labels.hidePreview,
          renderPreview: renderMermaidPreview,
          // Blocks with a preview (Mermaid) show only the rendering until "Edit" is clicked
          previewOnlyByDefault: true,
        },
        [Crepe.Feature.Placeholder]: { text: labels.placeholder, mode: "doc" },
        [Crepe.Feature.ImageBlock]: {
          onUpload: uploadImage,
          proxyDomURL: resolveUrl,
          inlineUploadButton: labels.upload,
          inlineConfirmButton: labels.confirm,
          inlineUploadPlaceholderText: labels.imageUrlPlaceholder,
          blockUploadButton: labels.upload,
          blockConfirmButton: labels.confirm,
          blockUploadPlaceholderText: labels.imageUrlPlaceholder,
          blockCaptionPlaceholderText: labels.captionPlaceholder,
        },
        [Crepe.Feature.LinkTooltip]: {
          editButton: labels.editSource,
          removeButton: labels.remove,
          confirmButton: labels.confirm,
          inputPlaceholder: labels.linkPlaceholder,
        },
        [Crepe.Feature.Latex]: { inlineEditConfirm: labels.confirm },
      },
    });

    let headings: OutlineHeading[] = [];
    // Counting walks the whole text, so coalesce it while typing in long documents
    const updateStats = debounce(
      (doc: Node) => props.onStatsChange(countText(readableText(doc))),
      200,
    );

    crepe.editor
      .config(preserveImageAlt)
      .config(editableHtmlSchema)
      .config((ctx) => {
        const style = markdownStyle(settings());
        ctx.update(remarkStringifyOptionsCtx, (options) => ({ ...options, ...style }));
      })
      .use(frontMatter)
      .use(details)
      .use(rawHtml(resolveUrl))
      .use(githubAlerts(labels.alerts))
      .use($prose(() => formatKeymap(() => crepe.editor)))
      .use(
        $prose(() =>
          syntaxRevealPlugin(() => ({
            strong: settings().strongMarker.repeat(2),
            emphasis: settings().emphasisMarker,
          })),
        ),
      )
      .use($prose(() => search()))
      .use($prose(() => textDirectionPlugin))
      .use($prose(() => focusModePlugin(() => settings().focusMode)))
      .use($prose(() => typewriterModePlugin(() => settings().typewriterMode)))
      .use(
        $prose(() =>
          documentObserverPlugin({
            onDocChange: (doc) => {
              headings = collectHeadings(doc);
              props.onOutlineChange(headings);
              updateStats(doc);
            },
            onSelectionChange: (cursor) =>
              props.onActiveHeadingChange(findActiveHeading(headings, cursor)),
          }),
        ),
      );
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => props.onMarkdownChange(markdown));
    });

    // The editor is created asynchronously; run its settings effect under the component owner so it is disposed with it
    const owner = getOwner();
    void crepe.create().then((editor) => {
      const editorView = editor.ctx.get(editorViewCtx);
      view = editorView;
      runWithOwner(owner, () => {
        createEffect(() => {
          editorView.dom.spellcheck = settings().spellcheck;
        });
        // Writing modes read their settings while rendering; an empty transaction re-renders them
        createEffect(
          on(
            () => [settings().focusMode, settings().typewriterMode],
            () => editorView.dispatch(editorView.state.tr),
            { defer: true },
          ),
        );
      });
      props.onReady(crepe.getMarkdown());
      editorView.focus();
    });

    const run = (command: Command): MatchStats => {
      if (!view) return { current: 0, total: 0 };
      command(view.state, view.dispatch);
      return matchStats(view);
    };

    props.ref({
      getMarkdown: () => crepe.getMarkdown(),
      focus: () => view?.focus(),
      scrollTo: (pos) => {
        if (!view) return;
        const { node } = view.domAtPos(pos + 1);
        const element = node instanceof Element ? node : node.parentElement;
        element?.scrollIntoView({ block: "start", behavior: "smooth" });
        view.focus();
      },
      getSelectedText: () => {
        if (!view) return "";
        const { from, to } = view.state.selection;
        return view.state.doc.textBetween(from, to, " ");
      },
      setSearch: (options) => {
        if (!view) return { current: 0, total: 0 };
        view.dispatch(setSearchState(view.state.tr, new SearchQuery(options)));
        return matchStats(view);
      },
      findNext: () => run(findNext),
      findPrevious: () => run(findPrev),
      replaceNext: () => run(replaceNext),
      replaceAll: () => run(replaceAll),
      format: (action) => {
        runFormatAction(crepe.editor, action);
        view?.focus();
      },
      persistImages: async (documentPath) => {
        if (view) await pendingImages.persist(view, documentPath);
      },
    });

    onCleanup(() => {
      updateStats.clear();
      void crepe.destroy();
    });
  });

  return (
    <ScrollView
      ref={(element) => (container = element)}
      class="size-full overflow-x-hidden print:h-auto print:overflow-visible"
    />
  );
};
