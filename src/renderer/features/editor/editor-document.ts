import { MARKDOWN_FILE } from "@shared/desktop-api";
import { pageStyle } from "@/features/export/page-style";
import { t } from "@/i18n";
import { fileNameOf, withoutDocumentExtension } from "@/lib/file";
import { escapeHtml } from "@/lib/html";
import { codeLanguageFor } from "@/lib/markdown/code-languages";

/** How a document's text is shown: Markdown rendered, any other text as it is, code by its grammar. */
export type DocumentKind = "markdown" | "text" | "code";

/** The title of an exported page: the document's file name without its extension. */
export function documentTitle(path: string | undefined): string {
  return withoutDocumentExtension(path ? fileNameOf(path) : t().common.untitledFileName);
}

/** Only a file whose extension is Markdown is rendered as Markdown; never guess from the text. */
export function documentKind(path: string | undefined): DocumentKind {
  if (path === undefined || MARKDOWN_FILE.test(path)) return "markdown";
  return codeLanguageFor(path) === undefined ? "text" : "code";
}

/** A page that shows a text or code file as it is, for the HTML and image exports. */
export function textDocumentHtml(title: string, text: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${pageStyle()}
body { white-space: pre-wrap; word-break: break-word; padding: 2rem; font-family: var(--code-font, ui-monospace, monospace); font-size: 0.875rem; line-height: 1.6; }
</style>
</head>
<body>${escapeHtml(text)}</body>
</html>`;
}
