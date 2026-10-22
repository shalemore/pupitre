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
import { onCleanup, onMount, type Component } from "solid-js";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { countText, type TextStats } from "@/lib/text-stats";
import { codeHighlight } from "./code-highlight";
import { preserveImageAlt } from "./image-block-schema";
import { renderMermaidPreview } from "./mermaid-preview";
import {
  collectHeadings,
  documentObserverPlugin,
  findActiveHeading,
  type OutlineHeading,
  textDirectionPlugin,
} from "./prose-plugins";

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

const MARKDOWN_STYLE = {
  bullet: "-",
  emphasis: "*",
  strong: "*",
  rule: "-",
  fence: "`",
  listItemIndent: "one",
} as const;

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

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

export const MarkdownEditor: Component<MarkdownEditorProps> = (props) => {
  let container: HTMLDivElement | undefined;
  let view: EditorView | undefined;

  const resolveUrl = (url: string): string => {
    if (!props.baseUrl || URL.canParse(url)) return url;
    return new URL(url, props.baseUrl).href;
  };

  // With a document path, images are saved into the assets folder next to it and inserted as relative paths; otherwise they can only be embedded as data URLs
  const uploadImage = async (file: File): Promise<string> => {
    if (!props.documentPath) return readAsDataUrl(file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    return desktop.invoke("document:save-image", props.documentPath, file.name, bytes);
  };

  onMount(() => {
    if (!container) return;
    const labels = t().editor;
    const crepe = new Crepe({
      root: container,
      defaultValue: props.markdown,
      features: {
        [Crepe.Feature.TopBar]: false,
        [Crepe.Feature.AI]: false,
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
        [Crepe.Feature.Placeholder]: { text: labels.placeholder, mode: "block" },
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
        [Crepe.Feature.Toolbar]: {
          boldLabel: labels.bold,
          italicLabel: labels.italic,
          strikethroughLabel: labels.strikethrough,
          codeLabel: labels.inlineCode,
          linkLabel: labels.link,
          latexLabel: labels.math,
        },
        [Crepe.Feature.BlockEdit]: {
          textGroup: {
            label: labels.groupText,
            text: { label: labels.paragraph },
            h1: { label: labels.heading(1) },
            h2: { label: labels.heading(2) },
            h3: { label: labels.heading(3) },
            h4: { label: labels.heading(4) },
            h5: { label: labels.heading(5) },
            h6: { label: labels.heading(6) },
            quote: { label: labels.quote },
            divider: { label: labels.divider },
          },
          listGroup: {
            label: labels.groupList,
            bulletList: { label: labels.bulletList },
            orderedList: { label: labels.orderedList },
            taskList: { label: labels.taskList },
          },
          advancedGroup: {
            label: labels.groupInsert,
            image: { label: labels.image },
            codeBlock: { label: labels.codeBlock },
            table: { label: labels.table },
            math: { label: labels.math },
          },
        },
      },
    });

    let headings: OutlineHeading[] = [];
    let statsTimer: number | undefined;
    const updateStats = (doc: Node) => {
      // Counting walks the whole text, so coalesce it while typing in long documents
      clearTimeout(statsTimer);
      statsTimer = window.setTimeout(
        () => props.onStatsChange(countText(doc.textBetween(0, doc.content.size, "\n", " "))),
        200,
      );
    };

    crepe.editor
      .config(preserveImageAlt)
      .config((ctx) => {
        // Use the most common Markdown style everywhere, so saving does not rewrite the list and emphasis markers of the whole document
        ctx.update(remarkStringifyOptionsCtx, (options) => ({ ...options, ...MARKDOWN_STYLE }));
      })
      .use($prose(() => search()))
      .use($prose(() => textDirectionPlugin))
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

    void crepe.create().then((editor) => {
      view = editor.ctx.get(editorViewCtx);
      props.onReady(crepe.getMarkdown());
      view.focus();
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
    });

    onCleanup(() => {
      clearTimeout(statsTimer);
      void crepe.destroy();
    });
  });

  return (
    <div
      ref={(element) => (container = element)}
      class="size-full overflow-x-hidden overflow-y-auto print:h-auto print:overflow-visible"
    />
  );
};
