import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import DOMPurify from "dompurify";
import { alertTitles, alertType } from "@/features/editor/alerts";
import { fencedText } from "@/features/editor/block-text";
import { detailsSection } from "@/features/editor/details";
import { HEADING_LEVEL } from "@/features/editor/document-structure";
import { footnoteLabel } from "@/features/editor/footnotes";
import { isRenderableHtml } from "@/features/editor/html";
import { documentBaseUrl } from "@/features/editor/images";
import { type InlineItem, inlineItems } from "@/features/editor/inline-content";
import { markdownLanguage } from "@/features/editor/markdown-language";
import { mathFence, mathOf } from "@/features/editor/math";
import { renderMath } from "@/features/editor/mathjax";
import { diagramTheme, readDiagramTheme, renderDiagram } from "@/features/editor/mermaid";
import { columnCount, readTable } from "@/features/editor/table-model";
import { baseDirection } from "@/features/editor/text-direction";
import { escapeHtml } from "@/lib/html";
import { codeHtml } from "./code-html";
import { pageStyle } from "./page-style";

/**
 * A document as HTML: as one self-contained page for File › Export as HTML, and as a fragment of
 * the same markup for Edit › Copy as HTML, which puts the selection in another application.
 *
 * The page is rendered from the editor's Lezer tree, the same nodes the live preview renders from,
 * so a construct that shows up in the editor shows up on the page; a code block is read by a second
 * parser, that of its own language, only to color it (code-html.ts). MathJax formulas and Mermaid
 * diagrams are drawn here, before the page is written, so the result needs no script and no
 * network to be read.
 */

/** Links to the web open in a tab of their own; an address inside the page stays in it. */
const EXTERNAL = /^https?:/i;

/** The markers of a quote, a list or a task, which sit beside the blocks they belong to. */
const MARKER = /(?:Mark|TaskMarker)$/;

/** The blocks among a node's children: its markers are not blocks. */
function blocksOf(node: SyntaxNode): SyntaxNode[] {
  const blocks: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (!MARKER.test(child.name)) blocks.push(child);
  }
  return blocks;
}

interface ExportContext {
  readonly state: EditorState;
  /** Footnote definitions, rendered together at the foot of the page where they were written. */
  readonly definitions: SyntaxNode[];
  /** Labels that already carry an anchor, so a second reference to a footnote needs no second id. */
  readonly referenced: Set<string>;
  /**
   * Whether the markup is going to another application, which has none of the stylesheets of this
   * one: what a class alone cannot carry is then written inline.
   */
  readonly inlineStyles: boolean;
}

/** The font code keeps where no stylesheet of Pupitre's follows the markup. */
const CODE_FONT = "font-family:Consolas,'Courier New',monospace";

/** A style attribute for the markup, or nothing when the page's own stylesheet already does the work. */
function styleOf(ctx: ExportContext, declaration: string): string {
  return ctx.inlineStyles ? ` style="${declaration}"` : "";
}

/** A picture address as the document wrote it: the page is saved next to the document, so the file:// address the app resolves would not follow it. */
function documentAddress(state: EditorState, source: string): string {
  const base = state.facet(documentBaseUrl);
  return base !== undefined && source.startsWith(base) ? source.slice(base.length) : source;
}

function linkHtml(href: string, inner: string): string {
  // A reference link without its definition has nowhere to go; its text still reads as a link
  if (href === "") return `<span class="md-link">${inner}</span>`;
  const target = EXTERNAL.test(href) ? ' target="_blank" rel="noreferrer"' : "";
  return `<a href="${escapeHtml(href)}"${target}>${inner}</a>`;
}

function footnoteReference(ctx: ExportContext, label: string): string {
  const id = ctx.referenced.has(label) ? "" : ` id="fnref-${escapeHtml(label)}"`;
  ctx.referenced.add(label);
  return `<sup class="md-footnote-ref"><a href="#fn-${escapeHtml(label)}"${id}>${escapeHtml(label)}</a></sup>`;
}

async function itemsHtml(ctx: ExportContext, items: readonly InlineItem[]): Promise<string> {
  const parts = await Promise.all(items.map((item) => itemHtml(ctx, item)));
  return parts.join("");
}

async function itemHtml(ctx: ExportContext, item: InlineItem): Promise<string> {
  switch (item.type) {
    case "text":
      return escapeHtml(item.text);
    case "break":
      return "<br>";
    case "element": {
      const attribute = item.class === undefined ? "" : ` class="${item.class}"`;
      const style = item.tag === "code" ? styleOf(ctx, CODE_FONT) : "";
      return `<${item.tag}${attribute}${style}>${await itemsHtml(ctx, item.children)}</${item.tag}>`;
    }
    case "link":
      return linkHtml(item.href, await itemsHtml(ctx, item.children));
    case "image":
      return `<img src="${escapeHtml(documentAddress(ctx.state, item.src))}" alt="${escapeHtml(item.alt)}">`;
    case "math":
      return `<span class="md-math">${await renderMath(item.tex, item.display)}</span>`;
    case "footnote":
      return footnoteReference(ctx, item.label);
  }
}

/** A formula on lines of its own, which may be wider than the page. */
async function displayMath(tex: string): Promise<string> {
  return `<div class="md-math-block">${await renderMath(tex, true)}</div>`;
}

/** A diagram as an inline SVG; a diagram Mermaid cannot draw keeps its source instead. */
async function diagram(ctx: ExportContext, source: string): Promise<string> {
  const theme = ctx.state.facet(diagramTheme);
  try {
    const drawing = Object.keys(theme).length > 0 ? theme : readDiagramTheme();
    return `<div class="md-mermaid">${await renderDiagram(source, drawing)}</div>`;
  } catch {
    return `<pre><code class="language-mermaid">${escapeHtml(source)}</code></pre>`;
  }
}

async function codeBlock(ctx: ExportContext, block: SyntaxNode): Promise<string> {
  const { state } = ctx;
  const formula = block.name === "FencedCode" ? mathFence(state, block) : undefined;
  if (formula !== undefined) return displayMath(formula);
  // Indented code keeps its indentation in the source, not in what it shows
  const code =
    block.name === "CodeBlock"
      ? state.sliceDoc(block.from, block.to).replace(/^(?: {4}|\t)/gm, "")
      : fencedText(state, block);
  const info = block.getChild("CodeInfo");
  const language = info ? (state.sliceDoc(info.from, info.to).trim().split(/\s+/)[0] ?? "") : "";
  if (language.toLowerCase() === "mermaid") return diagram(ctx, code);
  const name = language.replace(/[^\w+#.-]/g, "").toLowerCase();
  const attribute = name === "" ? "" : ` class="language-${name}"`;
  const text = code.replace(/\n$/, "");
  const highlighted = await codeHtml(text, language);
  // Markup that goes to another application carries the code font and keeps the code's own line breaks
  const pre = styleOf(ctx, `${CODE_FONT};white-space:pre-wrap`);
  return `<pre${pre}><code${attribute}${styleOf(ctx, CODE_FONT)}>${highlighted ?? escapeHtml(text)}</code></pre>`;
}

/** The number an ordered list starts at, when it does not start at one. */
function orderedStart(state: EditorState, first: SyntaxNode | undefined): number | undefined {
  const mark = first?.getChild("ListMark");
  if (!mark) return undefined;
  const number = Number.parseInt(state.sliceDoc(mark.from, mark.to), 10);
  return number > 1 ? number : undefined;
}

function alignmentStyle(alignment: string | undefined): string {
  if (alignment === "center") return ' style="text-align:center"';
  if (alignment === "end") return ' style="text-align:right"';
  return "";
}

async function tableHtml(ctx: ExportContext, block: SyntaxNode): Promise<string> {
  const table = readTable(ctx.state, block);
  const columns = columnCount(table);
  const row = async (cells: readonly { items: InlineItem[] }[] | undefined, tag: string) => {
    const columnsHtml = await Promise.all(
      Array.from({ length: columns }, async (_, column) => {
        const cell = cells?.[column];
        const style = alignmentStyle(table.alignments[column]);
        const inner = cell ? await itemsHtml(ctx, cell.items) : "";
        return `<${tag}${style}>${inner}</${tag}>`;
      }),
    );
    return `<tr>${columnsHtml.join("")}</tr>`;
  };
  const [header, ...body] = table.rows;
  const head = header ? `<thead>${await row(header.cells, "th")}</thead>` : "";
  const rows = await Promise.all(body.map((cells) => row(cells.cells, "td")));
  const foot = rows.length > 0 ? `<tbody>${rows.join("")}</tbody>` : "";
  return `<div class="md-table-scroll"><table>${head}${foot}</table></div>`;
}

/**
 * The paragraph a list item or a footnote shows without a wrapper of its own, and the blocks after
 * it; every other block of the list is rendered as a block.
 */
function leadingParagraph(blocks: readonly SyntaxNode[]): {
  leading: SyntaxNode | undefined;
  rest: SyntaxNode[];
} {
  const [first, ...rest] = blocks;
  return first?.name === "Paragraph"
    ? { leading: first, rest }
    : { leading: undefined, rest: [...blocks] };
}

async function listItem(ctx: ExportContext, item: SyntaxNode): Promise<string> {
  const { state } = ctx;
  const blocks = blocksOf(item);
  // A task marker carries the item's own text; any other item reads as its first paragraph
  const task = blocks[0]?.name === "Task" ? blocks[0] : undefined;
  const { leading, rest } = leadingParagraph(task === undefined ? blocks : blocks.slice(1));
  const own = task ?? leading;
  const inline = own === undefined ? "" : await itemsHtml(ctx, inlineItems(state, own));
  const marker = task?.getChild("TaskMarker") ?? undefined;
  const checked = marker !== undefined && /x/i.test(state.sliceDoc(marker.from, marker.to));
  const box =
    marker === undefined ? "" : `<input type="checkbox" disabled${checked ? " checked" : ""}>`;
  const kind =
    marker === undefined ? "" : checked ? ' class="md-task md-task-checked"' : ' class="md-task"';
  const nested = rest.length > 0 ? `\n${await renderBlocks(ctx, rest)}` : "";
  return `<li${kind}>${box}${inline.trim()}${nested}</li>`;
}

async function listBlock(ctx: ExportContext, block: SyntaxNode): Promise<string> {
  const tag = block.name === "OrderedList" ? "ol" : "ul";
  const items = blocksOf(block).filter((item) => item.name === "ListItem");
  const start = tag === "ol" ? orderedStart(ctx.state, items[0]) : undefined;
  const open = start === undefined ? `<${tag}>` : `<${tag} start="${start}">`;
  const html = await Promise.all(items.map((item) => listItem(ctx, item)));
  return `${open}\n${html.join("\n")}\n</${tag}>`;
}

/** The text of a quote's opening paragraph after its alert marker, when anything follows it. */
async function alertBody(ctx: ExportContext, paragraph: SyntaxNode): Promise<string> {
  const line = ctx.state.doc.lineAt(paragraph.from);
  if (line.to >= paragraph.to) return "";
  const items = inlineItems(ctx.state, paragraph, line.to + 1, paragraph.to);
  return `<p>${(await itemsHtml(ctx, items)).trim()}</p>`;
}

/** The alert a quote opens with, if it opens with one. */
function quoteAlert(ctx: ExportContext, paragraph: SyntaxNode | undefined) {
  if (paragraph?.name !== "Paragraph") return undefined;
  const line = ctx.state.doc.lineAt(paragraph.from);
  return alertType(ctx.state.sliceDoc(paragraph.from, line.to));
}

async function quoteBlock(ctx: ExportContext, quote: SyntaxNode): Promise<string> {
  const blocks = blocksOf(quote);
  const first = blocks[0];
  const titles = ctx.state.facet(alertTitles);
  const type = quoteAlert(ctx, first);
  if (type === undefined || titles === undefined || first === undefined) {
    return `<blockquote>\n${await renderBlocks(ctx, blocks)}\n</blockquote>`;
  }
  // The marker line reads as the title; the rest of the quote, and of that paragraph, follows it
  const body = await alertBody(ctx, first);
  const rest = await renderBlocks(ctx, blocks.slice(1));
  const title = `<p class="md-alert-title">${escapeHtml(titles[type])}</p>`;
  return `<blockquote class="md-alert" data-alert="${type}">${title}${body}${rest}</blockquote>`;
}

async function headingBlock(ctx: ExportContext, block: SyntaxNode, level: string): Promise<string> {
  const items = inlineItems(ctx.state, block);
  return `<h${level}>${(await itemsHtml(ctx, items)).trim()}</h${level}>`;
}

async function footnoteSection(ctx: ExportContext): Promise<string> {
  const items = await Promise.all(
    ctx.definitions.map(async (definition) => {
      const node = definition.getChild("FootnoteLabel");
      if (!node) return "";
      const label = footnoteLabel(ctx.state, node);
      const blocks = blocksOf(definition).filter((child) => child.name !== "FootnoteLabel");
      const { leading, rest } = leadingParagraph(blocks);
      const inline =
        leading === undefined ? "" : (await itemsHtml(ctx, inlineItems(ctx.state, leading))).trim();
      const nested = rest.length > 0 ? `\n${await renderBlocks(ctx, rest)}` : "";
      const back = ctx.referenced.has(label)
        ? ` <a class="md-footnote-back" href="#fnref-${escapeHtml(label)}">↩</a>`
        : "";
      return `<li id="fn-${escapeHtml(label)}">${inline}${back}${nested}</li>`;
    }),
  );
  const html = items.filter((item) => item !== "");
  return `<section class="md-footnotes">\n<ol>\n${html.join("\n")}\n</ol>\n</section>`;
}

async function renderBlock(ctx: ExportContext, block: SyntaxNode): Promise<string> {
  const { state } = ctx;
  const heading = HEADING_LEVEL.exec(block.name);
  if (heading) return headingBlock(ctx, block, heading[1] ?? "1");
  switch (block.name) {
    case "Paragraph":
      return `<p>${await itemsHtml(ctx, inlineItems(state, block))}</p>`;
    case "Blockquote":
      return quoteBlock(ctx, block);
    case "BulletList":
    case "OrderedList":
      return listBlock(ctx, block);
    case "FencedCode":
    case "CodeBlock":
      return codeBlock(ctx, block);
    case "BlockMath":
      return displayMath(mathOf(state, block).tex);
    case "Table":
      return tableHtml(ctx, block);
    case "HorizontalRule":
      return "<hr>";
    case "HTMLBlock": {
      const source = state.sliceDoc(block.from, block.to);
      return isRenderableHtml(source)
        ? `<div class="md-html-block">${DOMPurify.sanitize(source)}</div>`
        : "";
    }
    case "FootnoteDefinition":
      ctx.definitions.push(block);
      return "";
    default:
      // Comments, link references and front matter are source the reader never sees
      return "";
  }
}

async function detailsBlock(
  section: { summary: string; open: boolean },
  inner: Promise<string>,
): Promise<string> {
  const open = section.open ? " open" : "";
  return `<details${open}><summary>${escapeHtml(section.summary)}</summary>\n${await inner}</details>`;
}

function renderBlocks(ctx: ExportContext, blocks: readonly SyntaxNode[]): Promise<string> {
  const parts: Promise<string>[] = [];
  let index = 0;
  while (index < blocks.length) {
    const block = blocks[index];
    index++;
    if (!block) continue;
    // A <details> section is two HTML blocks with Markdown between them, so it takes its content
    // with it; the closing block is not rendered on its own
    const section = block.name === "HTMLBlock" ? detailsSection(ctx.state, block) : undefined;
    if (section) {
      const closing = section.closing;
      const end =
        closing === null ? blocks.length : blocks.findIndex((other) => other.from >= closing.from);
      const stop = end < 0 ? blocks.length : end;
      const inner = renderBlocks(ctx, blocks.slice(index, stop));
      parts.push(detailsBlock(section, inner));
      index = stop + 1;
      continue;
    }
    parts.push(renderBlock(ctx, block));
  }
  return Promise.all(parts).then((html) => html.filter((part) => part !== "").join("\n"));
}

/**
 * The state a fragment is rendered from: the text on its own, read by the same tree. Only the
 * titles are carried over from `source`, because without them a callout would render its marker
 * line rather than its title.
 */
function fragmentState(source: EditorState, markdown: string): EditorState {
  const titles = source.facet(alertTitles);
  return EditorState.create({
    doc: markdown,
    extensions:
      titles === undefined ? [markdownLanguage] : [markdownLanguage, alertTitles.of(titles)],
  });
}

/**
 * The blocks of a document and the footnotes they refer to, as the content of a page or of a
 * fragment.
 */
async function contentOf(ctx: ExportContext): Promise<string> {
  const blocks = blocksOf(syntaxTree(ctx.state).topNode);
  const body = await renderBlocks(ctx, blocks);
  const footnotes = ctx.definitions.length > 0 ? await footnoteSection(ctx) : "";
  return [body, footnotes].filter((part) => part !== "").join("\n");
}

/** The document as a page of its own, titled `title` and styled by the theme in use. */
export async function documentHtml(state: EditorState, title: string): Promise<string> {
  const ctx: ExportContext = {
    state,
    definitions: [],
    referenced: new Set(),
    inlineStyles: false,
  };
  const body = await contentOf(ctx);
  const textDirection = baseDirection(state.doc);
  const lang = document.documentElement.lang || "en";
  const dir = textDirection === undefined ? "" : ` dir="${textDirection}"`;
  return `<!doctype html>
<html lang="${escapeHtml(lang)}"${dir}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${pageStyle()}</style>
</head>
<body>
<article class="md-document">
${body}
</article>
</body>
</html>
`;
}

/**
 * `markdown` as an HTML fragment, for the clipboard: a selection is read as a document of its own,
 * so a table or a list its bounds cut short renders as far as the parser can still tell and the
 * rest of the page stays out of it. The state is the one the text was cut from.
 */
export async function markdownFragment(source: EditorState, markdown: string): Promise<string> {
  const ctx: ExportContext = {
    state: fragmentState(source, markdown),
    definitions: [],
    referenced: new Set(),
    inlineStyles: true,
  };
  return `<div class="md-document">\n${await contentOf(ctx)}\n</div>`;
}
